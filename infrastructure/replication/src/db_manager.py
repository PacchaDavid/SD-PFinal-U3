import logging
import time
from typing import Any

import pymysql
from pymysql.cursors import DictCursor

from src.models import ReplicaNodeState, ReplicaStatus

logger = logging.getLogger("replication.db")

CREATE_REPLICATION_LOG_TABLE = """
CREATE TABLE IF NOT EXISTS replication_log (
    id VARCHAR(36) PRIMARY KEY,
    operation VARCHAR(20) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(100) NOT NULL,
    service VARCHAR(50) NOT NULL DEFAULT '',
    data JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DOUBLE NOT NULL,
    propagated_at DOUBLE DEFAULT 0,
    ack_count INT DEFAULT 0,
    total_replicas INT DEFAULT 3,
    error TEXT,
    retry_count INT DEFAULT 0,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_service (service)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""


class DatabaseManager:
    """Gestiona conexiones a la base de datos primary y réplicas."""

    def __init__(self, primary_config: dict, replicas_config: list):
        self._primary_config = primary_config
        self._replica_configs = replicas_config
        self._primary_conn = None
        self._replica_states: dict[int, ReplicaNodeState] = {}

        # Inicializar estados de réplicas
        for cfg in replicas_config:
            rid = cfg["id"]
            self._replica_states[rid] = ReplicaNodeState(
                replica_id=rid,
                host=cfg.get("host", "localhost"),
                port=int(cfg.get("port", 3306)),
                database=cfg.get("database", "streaming"),
                user=cfg.get("user", "streaming"),
                password=cfg.get("password", ""),
            )

    # ------------------------------------------------------------------
    # Primary DB
    # ------------------------------------------------------------------

    def connect_primary(self) -> bool:
        """Conecta a la base de datos primaria y crea la tabla si no existe."""
        try:
            self._primary_conn = pymysql.connect(
                host=self._primary_config["host"],
                port=int(self._primary_config["port"]),
                user=self._primary_config["user"],
                password=self._primary_config["password"],
                database=self._primary_config["database"],
                charset="utf8mb4",
                cursorclass=DictCursor,
                connect_timeout=5,
            )
            self._ensure_table()
            logger.info("Conectado a primary DB: %s:%s/%s",
                        self._primary_config["host"],
                        self._primary_config["port"],
                        self._primary_config["database"])
            # Sincronizar schema a réplicas
            self._ensure_schema_on_replicas()
            return True
        except pymysql.Error as e:
            logger.error("Error conectando a primary DB: %s", e)
            self._primary_conn = None
            return False

    def _ensure_table(self) -> None:
        """Crea la tabla replication_log si no existe."""
        try:
            with self._primary_conn.cursor() as cursor:
                cursor.execute(CREATE_REPLICATION_LOG_TABLE)
            self._primary_conn.commit()
            logger.debug("Tabla replication_log asegurada")
        except pymysql.Error as e:
            logger.error("Error creando tabla replication_log: %s", e)

    def is_primary_connected(self) -> bool:
        if not self._primary_conn:
            return False
        try:
            self._primary_conn.ping(reconnect=True)
            return True
        except pymysql.Error:
            return False

    def insert_entry(self, entry: dict) -> bool:
        """Inserta una entrada en el replication_log."""
        if not self._primary_conn:
            return False
        try:
            with self._primary_conn.cursor() as cursor:
                sql = """INSERT INTO replication_log
                         (id, operation, table_name, record_id, service, data,
                          status, created_at, ack_count, total_replicas)
                         VALUES (%(id)s, %(operation)s, %(table_name)s,
                                 %(record_id)s, %(service)s, %(data)s,
                                 'PENDING', %(created_at)s, 0, %(total_replicas)s)"""
                cursor.execute(sql, entry)
            self._primary_conn.commit()
            return True
        except pymysql.Error as e:
            logger.error("Error insertando entry: %s", e)
            return False

    def get_pending_entries(self, limit: int = 50) -> list[dict]:
        """Obtiene entradas pendientes de replicar."""
        if not self._primary_conn:
            return []
        try:
            with self._primary_conn.cursor() as cursor:
                cursor.execute(
                    """SELECT * FROM replication_log
                       WHERE status IN ('PENDING', 'PROPAGATING')
                       ORDER BY created_at ASC LIMIT %s""",
                    (limit,),
                )
                return cursor.fetchall()
        except pymysql.Error as e:
            logger.error("Error obteniendo entradas pendientes: %s", e)
            return []

    def update_entry_status(self, entry_id: str, status: str,
                            ack_count: int = 0, error: str = "") -> bool:
        """Actualiza estado de una entrada de replicación."""
        if not self._primary_conn:
            return False
        try:
            with self._primary_conn.cursor() as cursor:
                sql = """UPDATE replication_log
                         SET status = %s, ack_count = %s, error = %s,
                             propagated_at = %s,
                             retry_count = retry_count + 1
                         WHERE id = %s"""
                cursor.execute(sql, (status, ack_count, error,
                                     time.time(), entry_id))
            self._primary_conn.commit()
            return True
        except pymysql.Error as e:
            logger.error("Error actualizando entry %s: %s", entry_id, e)
            return False

    def get_entry_count_by_status(self) -> dict:
        """Cuenta entradas agrupadas por estado."""
        if not self._primary_conn:
            return {}
        try:
            with self._primary_conn.cursor() as cursor:
                cursor.execute(
                    """SELECT status, COUNT(*) as count
                       FROM replication_log GROUP BY status"""
                )
                return {row["status"]: row["count"] for row in cursor.fetchall()}
        except pymysql.Error:
            return {}

    def get_failed_entries(self, limit: int = 100) -> list[dict]:
        """Obtiene entradas fallidas para reintento."""
        if not self._primary_conn:
            return []
        try:
            with self._primary_conn.cursor() as cursor:
                cursor.execute(
                    """SELECT * FROM replication_log
                       WHERE status = 'FAILED'
                       ORDER BY created_at ASC LIMIT %s""",
                    (limit,),
                )
                return cursor.fetchall()
        except pymysql.Error:
            return []

    # ------------------------------------------------------------------
    # Schema Sync
    # ------------------------------------------------------------------

    def _ensure_schema_on_replicas(self) -> None:
        """Sincroniza el schema (tablas) desde la primaria a las réplicas.

        Obtiene la definición DDL de cada tabla en la primaria via
        SHOW CREATE TABLE y la ejecuta en cada réplica.
        """
        # Obtener tablas de la primaria
        tables = []
        try:
            with self._primary_conn.cursor() as cursor:
                cursor.execute("SHOW TABLES")
                rows = cursor.fetchall()
                # El nombre del campo depende del driver
                tables = [list(row.values())[0] for row in rows]
        except Exception as e:
            logger.warning("Error obteniendo tablas de primaria: %s", e)
            return

        if not tables:
            logger.debug("No hay tablas que sincronizar")
            return

        logger.info("Sincronizando schema de %d tablas a réplicas...", len(tables))

        for replica_id in self._replica_states:
            state = self._replica_states[replica_id]
            try:
                conn = pymysql.connect(
                    host=state.host, port=state.port,
                    user=state.user, password=state.password,
                    database=state.database,
                    connect_timeout=5,
                )
                with conn.cursor() as cursor:
                    for table_name in tables:
                        # Obtener CREATE TABLE de la primaria
                        with self._primary_conn.cursor() as pc:
                            pc.execute(f"SHOW CREATE TABLE `{table_name}`")
                            create_stmt = list(pc.fetchone().values())[1]

                        # Ejecutar en réplica (IF NOT EXISTS incluido)
                        cursor.execute(create_stmt)
                        conn.commit()
                        logger.debug("Tabla '%s' creada/actualizada en réplica %d",
                                     table_name, replica_id)

                conn.close()
                logger.info("Schema sincronizado en réplica %d (%d tablas)",
                            replica_id, len(tables))

            except pymysql.Error as e:
                logger.warning("Error sincronizando schema en réplica %d: %s",
                               replica_id, e)

    # ------------------------------------------------------------------
    # Réplicas
    # ------------------------------------------------------------------

    def get_replica_states(self) -> dict[int, ReplicaNodeState]:
        return self._replica_states

    def get_replica(self, replica_id: int) -> ReplicaNodeState | None:
        return self._replica_states.get(replica_id)

    def check_replica_health(self, replica_id: int) -> bool:
        """Verifica si una réplica está accesible."""
        state = self._replica_states.get(replica_id)
        if not state:
            return False

        try:
            conn = pymysql.connect(
                host=state.host, port=state.port,
                user=state.user, password=state.password,
                database=state.database,
                connect_timeout=3,
            )
            conn.close()
            state.status = ReplicaStatus.HEALTHY
            state.last_health_check = time.time()
            return True
        except pymysql.Error:
            state.status = ReplicaStatus.UNHEALTHY
            state.last_health_check = time.time()
            return False

    def check_all_replicas_health(self) -> dict[int, bool]:
        """Verifica salud de todas las réplicas."""
        results = {}
        for rid in self._replica_states:
            results[rid] = self.check_replica_health(rid)
        return results

    def execute_on_replica(self, replica_id: int, operation: str,
                           table_name: str, data: dict) -> dict:
        """Ejecuta una operación SQL en una réplica.

        Returns:
            Dict con status, response_time_ms, error opcional.
        """
        state = self._replica_states.get(replica_id)
        if not state:
            return {"status": "ERROR", "error": "Réplica no encontrada"}

        conn = None
        start = time.time()
        try:
            conn = pymysql.connect(
                host=state.host, port=state.port,
                user=state.user, password=state.password,
                database=state.database,
                connect_timeout=5,
            )

            with conn.cursor() as cursor:
                # Parsear data JSON para obtener columnas
                import json
                row_data = json.loads(data) if isinstance(data, str) else data

                if operation == "INSERT":
                    self._execute_insert(cursor, table_name, row_data)
                elif operation == "UPDATE":
                    self._execute_update(cursor, table_name, row_data)
                elif operation == "DELETE":
                    self._execute_delete(cursor, table_name, row_data)
                else:
                    conn.close()
                    return {"status": "ERROR",
                            "error": f"Operación desconocida: {operation}"}

            conn.commit()
            elapsed = (time.time() - start) * 1000

            # Actualizar estado de la réplica
            state.last_ack_time = time.time()
            state.total_acks += 1
            state.avg_response_time_ms = (
                (state.avg_response_time_ms * (state.total_acks - 1) + elapsed)
                / state.total_acks
            )

            return {"status": "ACK", "response_time_ms": round(elapsed, 2)}

        except pymysql.Error as e:
            elapsed = (time.time() - start) * 1000
            state.total_errors += 1
            return {"status": "ERROR", "error": str(e),
                    "response_time_ms": round(elapsed, 2)}

        finally:
            if conn:
                conn.close()

    def _execute_insert(self, cursor, table: str, data: dict) -> None:
        """Ejecuta INSERT en réplica ignorando duplicados."""
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f"%({k})s" for k in data.keys()])
        sql = f"INSERT IGNORE INTO {table} ({columns}) VALUES ({placeholders})"
        cursor.execute(sql, data)

    def _execute_update(self, cursor, table: str, data: dict) -> None:
        """Ejecuta UPDATE en réplica."""
        record_id = data.get("id")
        if not record_id:
            raise ValueError("UPDATE requiere campo 'id'")
        sets = ", ".join([f"{k} = %({k})s" for k in data.keys() if k != "id"])
        sql = f"UPDATE {table} SET {sets} WHERE id = %(id)s"
        cursor.execute(sql, data)

    def _execute_delete(self, cursor, table: str, data: dict) -> None:
        """Ejecuta DELETE en réplica."""
        record_id = data.get("id")
        if not record_id:
            raise ValueError("DELETE requiere campo 'id'")
        cursor.execute(f"DELETE FROM {table} WHERE id = %s", (record_id,))

    # ------------------------------------------------------------------
    # Limpieza
    # ------------------------------------------------------------------

    def close(self) -> None:
        if self._primary_conn:
            try:
                self._primary_conn.close()
            except Exception:
                pass
            self._primary_conn = None
