# 🎬 Guía de Demostración — Plataforma Distribuida de Streaming

> **Propósito:** Esta guía explica paso a paso cómo demostrar los 4 conceptos clave
> del sistema: **Circuit Breaker**, **Heartbeats**, **Logs** y **Replicación**.
>
> Cada sección incluye: qué observar, cómo provocar el escenario y qué esperar.

---

## 📋 Requisitos previos

```bash
# 1. Todo el sistema debe estar funcionando
docker ps | head -5

# 2. Abrir el panel admin en el navegador
#    http://localhost:80/admin

# 3. Iniciar sesión como admin
#    Email:    admin@streaming.com
#    Password: admin123
```

---

## 1️⃣ Circuit Breaker

### 🧠 Concepto

El Circuit Breaker protege a los microservicios de fallos en cascada.
Cada servicio tiene un CB independiente que puede estar en 3 estados:

```
CLOSED    → Funcionamiento normal. Las requests pasan libremente.
OPEN      → El servicio falló. Las requests se rechazan inmediatamente.
HALF_OPEN → Estado de prueba. Se deja pasar una request para ver si ya se recuperó.
```

**Transiciones:**
```
CLOSED    → (5 fallos consecutivos)       → OPEN
OPEN      → (30 segundos)                 → HALF_OPEN
HALF_OPEN → (3 éxitos consecutivos)       → CLOSED
HALF_OPEN → (1 fallo)                     → OPEN
```

> **Nota:** En estado HALF_OPEN solo se permiten **3 requests** como máximo.
> Si envías más de 3 éxitos, los adicionales serán ignorados hasta que el
> circuito pase a CLOSED y vuelva a abrirse.

### 🎯 Demostración

#### A. Estado normal — todos CLOSED

```
1. Abre: http://localhost:80/admin/circuit-breakers
2. Observa:
   ┌──────────────┬──────────┬───────┐
   │ Servicio     │ Estado   │ Fallos│
   ├──────────────┼──────────┼───────┤
   │ 🟢 usuarios  │ CLOSED   │ 0     │
   │ 🟢 recomenda.│ CLOSED   │ 0     │
   │ 🟢 pagos     │ CLOSED   │ 0     │
   └──────────────┴──────────┴───────┘
```

#### B. ⚡ Abrir un Circuit Breaker — AUTOMÁTICAMENTE

> **NOVEDAD:** El CB ahora se abre **automáticamente**. El **Load Balancer**
> reporta los fallos al CB cuando las peticiones reales de la aplicación fallan.
> Ya no necesitas curls manuales a la API del CB.

```bash
# 1. Tumbar el servicio real
docker stop streaming-recomendaciones
```

```
2. Desde el panel admin, intenta CREAR PELÍCULAS o ver el catálogo.
   El frontend hace peticiones al Load Balancer (puerto 8000), que:
   - Intenta forwardear al servicio → falla (502)
   - Reporta el fallo automáticamente al Circuit Breaker
   - Tras 5 fallos consecutivos, el CB se ABRE SOLO

3. Observa en tiempo real (http://localhost:80/admin/circuit-breakers):
   ┌──────────────┬──────────┬───────┐
   │ 🟢 usuarios  │ CLOSED   │ 0     │
   │ 🔴 recomenda.│ OPEN     │ 5+    │ ← SE ABRIÓ SOLO
   │ 🟢 pagos     │ CLOSED   │ 0     │
   └──────────────┴──────────┴───────┘

4. Ve a la página de Catálogo → verás el TOP 10 genérico
   (el Load Balancer sirve el fallback del CB automáticamente)
```

```bash
# Alternativa: simular lo que haría el frontend vía Load Balancer
for i in $(seq 1 6); do
  curl -s -o /dev/null -w '%{http_code}' \
    http://localhost:8000/api/recomendaciones/api/recomendaciones
  echo ""
done
```

#### C. Explicar el HALF_OPEN y recuperación

```bash
# Esperar 30 segundos (timeout del CB)
echo "Esperando 35s para que pase a HALF_OPEN..."
sleep 35

# Verificar estado
curl -s http://localhost:8084/circuits/recomendaciones | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(f'Estado: {d[\"state\"]}')"
```

```
5. Observa:
   ┌──────────────┬────────────┬───────┐
   │ 🟡 recomenda.│ HALF_OPEN  │ 6     │ ← Transición automática
   └──────────────┴────────────┴───────┘

6. Restaurar el servicio y cerrar el CB:
```

```bash
docker start streaming-recomendaciones
sleep 5

# Enviar 3 éxitos para cerrar el circuito
for i in $(seq 1 3); do
  curl -s -X POST "http://localhost:8084/circuits/recomendaciones/success"
  echo ""
done
```

```
7. Observa:
   ┌──────────────┬──────────┬───────┐
   │ 🟢 recomenda.│ CLOSED   │ 0     │ ← Se recuperó solo
   └──────────────┴──────────┴───────┘
   (El contador de fallos se reseteó al volver a CLOSED)
```

#### D. Demo rápida del CB automático (creando películas desde admin)

```bash
# 1. Desde el panel admin, crear una película funciona normalmente
# 2. Tumbar recomendaciones:
docker stop streaming-recomendaciones

# 3. Intentar crear 5+ películas desde el admin → todas fallan
#    Cada fallo es reportado al CB automáticamente por el Load Balancer
# 4. Al llegar a 5 fallos, el CB se abre SOLO
# 5. El catálogo muestra el TOP 10 genérico (fallback automático)
# 6. Restaurar:
docker start streaming-recomendaciones

# 7. Cerrar el CB:
for i in $(seq 1 3); do
  curl -s -X POST "http://localhost:8084/circuits/recomendaciones/success" > /dev/null
done
```

#### E. (Alternativa) Abrir CB manualmente sin tumbar servicios

Si prefieres no tumbar servicios reales durante la demo:

```bash
for i in $(seq 1 6); do
  curl -s -X POST "http://localhost:8084/circuits/pagos/failures" \
    -H "Content-Type: application/json" \
    -d '{"error":"Demo: abriendo CB de pagos"}'
  echo ""
done

# Cerrar con 3 éxitos
for i in $(seq 1 3); do
  curl -s -X POST "http://localhost:8084/circuits/pagos/success"
  echo ""
done
```

> ⚡ **Tip:** Puedes simular la transición OPEN → HALF_OPEN esperando 30s
> (el timeout del CB), o forzarla con:
> ```bash
> curl -s -X POST "http://localhost:8084/circuits/pagos/success"
> ```
> (Si el circuito está OPEN, un success lo fuerza a HALF_OPEN inmediatamente)

---

## 2️⃣ Heartbeats

### 🧠 Concepto

Cada servicio del sistema publica su estado cada **2 segundos** en **Redis Pub/Sub**
(canal `heartbeats`). El Event Monitor está suscrito a Redis y reenvía los
heartbeats al frontend por **WebSocket**.

```
Servicio ──publica cada 2s──→ Redis ──consume──→ Event Monitor ──WebSocket──→ Frontend

Si un servicio deja de publicar por 10 segundos (3 heartbeats perdidos):
  ACTIVE → INACTIVE  (se muestra en rojo en el panel)
```

### 🎯 Demostración

#### A. Mostrar el flujo normal

```
1. Abre: http://localhost:80/admin/heartbeats
2. Observa la tabla:
   ┌─────────────────────────────────┬──────────────────┬─────────┬─────────────────┐
   │ Nodo                            │ Servicio         │ Estado  │ Último Heartbeat│
   ├─────────────────────────────────┼──────────────────┼─────────┼─────────────────┤
   │ 🟢 Load Balancer                │ load-balancer    │ active  │ 12:30:45        │
   │ 🟢 Event Monitor                │ event-monitor    │ active  │ 12:30:45        │
   │ 🟢 Circuit Breaker Service      │ circuit-breaker  │ active  │ 12:30:45        │
   │ 🟢 usuarios-service             │ usuarios-service │ active  │ 12:30:44        │
   │ 🟢 pagos-service                │ pagos-service    │ active  │ 12:30:44        │
   │ 🟢 recomendaciones-service      │ recomen-serv     │ active  │ 12:30:44        │
   │ 🟢 Replication - usuarios       │ replication      │ active  │ 12:30:44        │
   │ 🟢 Replication - recomendaciones│ replication      │ active  │ 12:30:44        │
   └─────────────────────────────────┴──────────────────┴─────────┴─────────────────┘
   
3. Explicar: 8 nodos monitoreados en tiempo real, cada columna:
   - Nodo: nombre del servicio
   - Servicio: tipo de servicio
   - Estado: 🟢 active / 🔴 inactive
   - Último Heartbeat: timestamp del último pulso
   - Latencia: tiempo de respuesta (si aplica)
```

#### B. Tumbar un servicio y ver el heartbeat perderse

```bash
# 1. Detener un servicio
docker stop streaming-pagos
```

```
2. Observa el contador de heartbeats:
   - Los heartbeats de pagos dejarán de llegar
   - Después de 3 heartbeats perdidos (~10s):
     
     ┌─────────────────┬──────────┐
     │ 🟢 pagos-service │ active   │ ← Sigue verde por unos segundos
     └─────────────────┴──────────┘
     → 3s después...
     → 10s después (3 heartbeats perdidos)...
     ┌─────────────────┬────────────┐
     │ 🔴 pagos-service │ inactive   │ ← Rojo: nodo caído
     └─────────────────┴────────────┘

3. El Dashboard también refleja el cambio:
   Antes: 8/8 nodos activos
   Después: 7/8 nodos activos, 1 inactivo
```

#### C. Restaurar y ver la reactivación

```bash
docker start streaming-pagos
```

```
4. Observa:
   - En ~5s el nodo vuelve a ACTIVE
   - NO se crea un duplicado (el sistema reactiva la entrada existente)
   - El contador vuelve a 8/8
```

#### D. Explicar la arquitectura de heartbeats

```
🗺️ Diagrama de flujo de heartbeats:

  ┌──────────────┐      publica cada 2s     ┌─────────────┐
  │ Servicio     │─────canal "heartbeats"───→│    Redis    │
  │ (Python/Java)│                          │  Pub/Sub    │
  └──────────────┘                          └──────┬──────┘
                                                   │ suscrito
                                                   ▼
                                           ┌──────────────┐
                                           │Event Monitor │
                                           │(Flask+Socket)│
                                           └──────┬───────┘
                                                   │ WebSocket
                                                   ▼
                                           ┌──────────────┐
                                           │   Frontend   │
                                           │  (React)     │
                                           └──────────────┘
  
  ✅ Ya no hay HTTP para heartbeats — todo va por Redis Pub/Sub
  ✅ Si un nodo se reinicia con nuevo hostname, se reactiva sin duplicar
  ✅ El frontend recibe actualizaciones en tiempo real por WebSocket
```

---

## 3️⃣ Logs

### 🧠 Concepto

Todos los eventos del sistema (heartbeat perdido, CB abierto, replicación completada,
etc.) se almacenan en el Event Monitor y se pueden consultar vía REST o WebSocket.

**Tipos de eventos:**
| Severidad | Significado | Color |
|---|---|---|
| `INFO` | Operación normal (nodo registrado, heartbeat recibido) | 🔵 |
| `WARNING` | Situación anómala (heartbeat perdido, degradado) | 🟡 |
| `ERROR` | Fallo (CB abierto, replicación fallida) | 🔴 |

### 🎯 Demostración

#### A. Mostrar los logs en vivo

```
1. Abre: http://localhost:80/admin/logs
2. Muestra los filtros disponibles:
   ┌─────────────────┬────────────┬──────────────┐
   │ 🔍 Buscar...   │ 📋 Nivel   │ 🔧 Servicio  │
   └─────────────────┴────────────┴──────────────┘

3. Los logs se actualizan solos en tiempo real (WebSocket).
   Observa cómo aparecen nuevos eventos sin recargar la página.
```

#### B. Generar eventos para verlos aparecer

```bash
# 1. Forzar un heartbeat perdido
docker stop streaming-recomendaciones
sleep 15
```

```
2. En la página de Logs, aparecerá automáticamente:
   ┌──────────┬──────────────────┬──────────────────────────────────────────────┐
   │ WARNING  │ heartbeat-monitor│ Nodo recomendaciones-service cambió a        │
   │          │                  │ INACTIVE tras 3 heartbeats perdidos          │
   └──────────┴──────────────────┴──────────────────────────────────────────────┘

3. Al restaurar:
```

```bash
docker start streaming-recomendaciones
```

```
   ┌──────────┬──────────────────┬──────────────────────────────────────────────┐
   │ INFO     │ heartbeat-monitor│ Nodo recomendaciones-service restaurado a    │
   │          │                  │ ACTIVE                                       │
   └──────────┴──────────────────┴──────────────────────────────────────────────┘
```

#### C. Filtrar por tipo de evento

```bash
# Generar eventos de CB
curl -s -X POST "http://localhost:8084/circuits/pagos/failures" \
  -H "Content-Type: application/json" \
  -d '{"error":"Fallo para demo de logs"}'
```

```
4. Usa el filtro "Nivel" → selecciona "ERROR"
5. Usa el filtro "Servicio" → selecciona "Circuit Breaker"
6. Usa el buscador textual → escribe "pagos"
   → Solo muestra los logs relevantes
```

#### D. Explicar el flujo de eventos

```
🗺️ Flujo de un evento desde que ocurre hasta que se ve en pantalla:

  1. Ocurre un evento (CB se abre, nodo cae, réplica confirma)
  2. El servicio publica en Redis (canal "events")
  3. Event Monitor recibe y almacena en memoria
  4. Event Monitor reenvía por WebSocket al frontend
  5. Frontend muestra en Logs (y actualiza Dashboard si aplica)
  
  ⏱️ Latencia total: < 500ms
```

---

## 4️⃣ Replicación

### 🧠 Concepto

Cada microservicio tiene **1 base de datos primaria** y **3 réplicas**.
El **Replication Manager** (Python) se encarga de propagar los cambios.

```
                    ┌──────────────┐
                    │   Servicio   │
                    │   (Spring)   │
                    └──────┬───────┘
                           │ INSERT / UPDATE
                           ▼
                    ┌──────────────┐      ┌──────────────────┐
                    │ DB Primaria  │◄────│ReplicationLogWriter│
                    └──────┬───────┘     │(Java → POST al RM)│
                           │             └──────────────────┘
                           │ replication_log (WAL)
                           ▼
                    ┌──────────────┐
                    │Replication   │
                    │Manager (RM)  │ ← Polling cada 500ms
                    └───┬───┬───┬──┘
                        │   │   │
                   ┌────┘   │   └────┐
                   ▼        ▼        ▼
            ┌──────────┐┌──────────┐┌──────────┐
            │ Réplica 1││ Réplica 2││ Réplica 3│
            └──────────┘└──────────┘└──────────┘
                   │        │        │
                   └────────┴────────┘
                    Quorum mínimo: 2/3 ACKs
                    Si ≥ 2 ACKs → REPLICATED ✅
                    Si < 2 ACKs → FAILED ❌
```

### 🎯 Demostración

#### A. Mostrar el estado de replicación

```
1. Abre: http://localhost:80/admin/replication
2. Observa:
   - Quorum: 2/3 mínimo
   - Servicios: usuarios, recomendaciones, pagos
   - Cada servicio con 3 réplicas online (🟢)
   - Barra de progreso al 100%
```

#### B. Crear datos nuevos y ver la replicación en vivo

```bash
# 1. Obtener token de admin
TOKEN=$(curl -s -X POST http://localhost:8000/api/usuarios/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@streaming.com","password":"admin123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# 2. Crear una película (esto dispara la replicación)
echo "=== Creando película ==="
curl -s -X POST http://localhost:8000/api/recomendaciones/api/recomendaciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title":"Película Demo",
    "description":"Creada durante la demostración de replicación",
    "genre":"Demo",
    "durationMinutes":120,
    "releaseYear":2026,
    "rating":"PG",
    "imdbRating":8.5,
    "director":"Equipo Demo",
    "cast":"Demo Cast",
    "price":4.99,
    "featured":true
  }'
```

```
3. Inmediatamente después, ve a Replicación:
   Aparecerá una nueva entrada:
   ┌──────────┬──────────────┬──────────┬────────────┬───────┐
   │ ID       │ Servicio     │ Operación│ Estado     │ ACKs  │
   ├──────────┼──────────────┼──────────┼────────────┼───────┤
   │ #14      │ recomendac.  │ INSERT   │ REPLICATED │ 3/3   │ ← NUEVA
   └──────────┴──────────────┴──────────┴────────────┴───────┘
   
   El estado cambia de PENDING → PARTIAL → REPLICATED en ~2s
```

#### C. Verificar los datos en las réplicas

```bash
# Ver en primaria
echo "=== DB Primaria ==="
docker exec streaming-recomendaciones-db-primary \
  mariadb -uroot -proot_secret_2024 streaming_recomendaciones \
  -e "SELECT id, title FROM movies ORDER BY id DESC LIMIT 3;"

# Ver en cada réplica
for r in 1 2 3; do
  echo "=== Réplica $r ==="
  docker exec streaming-recomendaciones-db-replica$r \
    mariadb -uroot -proot_secret_2024 streaming_recomendaciones \
    -e "SELECT id, title FROM movies ORDER BY id DESC LIMIT 3;"
done
```

```
Antes:
  Primaria: 15 películas
  Réplica 1: 15 películas ✅
  Réplica 2: 15 películas ✅
  Réplica 3: 15 películas ✅

Después de crear "Película Demo":
  Primaria: 16 películas
  Réplica 1: 16 películas ✅  ← replicada automáticamente
  Réplica 2: 16 películas ✅
  Réplica 3: 16 películas ✅
```

#### D. Simular fallo en una réplica

```bash
# (Opcional) Detener una réplica
docker stop streaming-recomendaciones-db-replica3

# Crear otra película
curl -s -X POST http://localhost:8000/api/recomendaciones/api/recomendaciones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Réplica Caída","genre":"Test","durationMinutes":90,"releaseYear":2026,"rating":"PG","imdbRating":7.0,"director":"Test","cast":"Test","price":2.99,"featured":false}'
```

```
Observa en Replicación:
  ┌──────────┬──────────────┬──────────┬────────────┬───────┐
  │ ID       │ Servicio     │ Operación│ Estado     │ ACKs  │
  ├──────────┼──────────────┼──────────┼────────────┼───────┤
  │ #15      │ recomendac.  │ INSERT   │ PARTIAL    │ 2/3   │ ← Quorum mínimo
  └──────────┴──────────────┴──────────┴────────────┴───────┘
  
  Aún con 1 réplica caída, el quorum 2/3 permite que la operación sea exitosa.
  
  Al restaurar la réplica:
  docker start streaming-recomendaciones-db-replica3
  # (Se sincronizará automáticamente con los datos perdidos)
```

#### E. Ver el WAL (Write-Ahead Log)

```bash
# Ver las entradas del WAL en la primaria
docker exec streaming-recomendaciones-db-primary \
  mariadb -uroot -proot_secret_2024 streaming_recomendaciones \
  -e "SELECT id, table_name, operation, status, ack_count, created_at 
      FROM replication_log ORDER BY id DESC LIMIT 5;"
```

```
Resultado:
  ┌─────┬────────────┬───────────┬────────────┬───────────┬──────────────────┐
  │ id  │ table_name │ operation │ status     │ ack_count │ created_at       │
  ├─────┼────────────┼───────────┼────────────┼───────────┼──────────────────┤
  │ 15  │ movies     │ INSERT    │ REPLICATED │ 3         │ 2026-07-26 ...   │
  │ 14  │ movies     │ INSERT    │ REPLICATED │ 3         │ 2026-07-26 ...   │
  │ ... │ movies     │ INSERT    │ REPLICATED │ 3         │ ...              │
  │ 1   │ movies     │ INSERT    │ REPLICATED │ 3         │ 2026-07-26 ...   │
  └─────┴────────────┴───────────┴────────────┴───────────┴──────────────────┘
```

---

## 🎬 Demo Rápida (5 minutos)

Si tienes poco tiempo, esta es la secuencia mínima:

| # | Acción | Página | Qué observar | Tiempo |
|---|---|---|---|---|
| 1 | Abrir panel admin | Dashboard | 8/8 nodos, 3 circuitos CLOSED | 30s |
| 2 | Abrir Heartbeats | `/admin/heartbeats` | 8 nodos activos en tiempo real | 30s |
| 3 | Tumbar servicio | Terminal | `docker stop streaming-recomendaciones` | 5s |
| 4 | Esperar 10s | Heartbeats | Nodo pasa a INACTIVE 🔴 | 10s |
| 5 | Hacer 6 peticiones vía LB | Admin o terminal | El CB se abre **solo** (automático) | 10s |
| 6 | Ver CB abierto | `/admin/circuit-breakers` | recomendaciones OPEN 🔴 | 5s |
| 7 | Ver fallback en catálogo | Catálogo | TOP 10 genérico (sin curls manuales) | 5s |
| 8 | Ver logs del evento | `/admin/logs` | WARNING: heartbeat perdido | 5s |
| 9 | Restaurar servicio | Terminal | `docker start streaming-recomendaciones` | 2s |
| 10 | Crear película | Terminal | `curl -X POST ...` con token | 5s |
| 11 | Ver replicación | `/admin/replication` | Nueva entrada REPLICATED ✅ | 5s |
| 12 | Ver heartbeats recuperados | Heartbeats | 8/8 activos otra vez 🟢 | 5s |

**Total: ~3 minutos**

---

## 🔧 Troubleshooting durante la demo

| Problema | Causa probable | Solución |
|---|---|---|
| CB no se abre | Faltan fallos (umbral es 5, o las requests no pasan por LB) | Asegurar que las peticiones van al **LB** (puerto 8000), no directo al servicio |
| Heartbeat no cambia a INACTIVE | Esperar ciclo completo (10s) | Esperar 15s, el monitor verifica cada 2s |
| Logs no aparecen | Filtro activo | Limpiar filtros (Nivel = Todos, Servicio = Todos) |
| Replicación no muestra datos | WAL vacío, datos históricos | Crear datos NUEVOS (el WAL solo registra post-instalación) |
| WebSocket desconectado | Event Monitor no responde | Verificar `curl http://localhost:8082/health` |
| 403 en API | Token expirado | Re-ejecutar login para obtener nuevo token |
