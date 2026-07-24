# 🎬 Plataforma Distribuida de Streaming

**Proyecto Académico** — Sistema distribuido sobre 5 máquinas físicas que demuestra conceptos de arquitectura distribuida, tolerancia a fallos, replicación, balanceo de carga y observabilidad en tiempo real.

---

## 📋 Tabla de Contenidos

1. [Arquitectura del Sistema](#-arquitectura-del-sistema)
2. [Componentes](#-componentes)
3. [Requisitos](#-requisitos)
4. [Configuración de Red y Puertos](#-configuración-de-red-y-puertos)
5. [Despliegue Rápido](#-despliegue-rápido)
6. [Diagrama de Flujo](#-diagrama-de-flujo)
7. [APIs](#-apis)
8. [Escenarios de Demostración](#-escenarios-de-demostración)
9. [Estructura del Proyecto](#-estructura-del-proyecto)
10. [Monitoreo y Observabilidad](#-monitoreo-y-observabilidad)
11. [Simulación de Fallos](#-simulación-de-fallos)

---

## 🏗 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     MÁQUINA 1 (Frontend)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React App (Puerto 80)                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐  │ │
│  │  │ Login/   │  │ Catálogo │  │ Panel de Admin      │  │ │
│  │  │ Registro │  │ Películas│  │ (Dashboard, Logs,   │  │ │
│  │  │          │  │          │  │  Heartbeats, Eventos)│  │ │
│  │  └──────────┘  └──────────┘  └─────────────────────┘  │ │
│  │                    │                ▲                   │ │
│  │              REST  │        WebSocket│                   │ │
│  └────────────────────┼────────────────┼───────────────────┘ │
└───────────────────────┼────────────────┼─────────────────────┘
                        │                │
┌───────────────────────┼────────────────┼─────────────────────┐
│              MÁQUINA 2 (Infraestructura Central)              │
│  ┌──────────────────┐ │  ┌─────────────┴──────────┐          │
│  │  Load Balancer   │◄┘  │    Event Monitor       │          │
│  │  (Python :8000)  │    │   (Flask-SocketIO      │          │
│  │  Round-robin     │    │    + WebSocket :5000)   │          │
│  └────────┬─────────┘    └─────────────────────────┘          │
│           │                         ▲                        │
│           │                         │ Pub/Sub                │
│           │              ┌──────────┴──────────┐              │
│           │              │      Redis          │              │
│           │              │   (Bus de Eventos)  │              │
│           │              └─────────────────────┘              │
└───────────┼───────────────────────────────────────────────────┘
            │
   ┌────────┼────────────┬────────────────────┐
   │        │            │                    │
┌──┴────┐ ┌─┴──────┐ ┌──┴────────┐  ┌───────┴────────┐
│MAQ 3  │ │ MAQ 4  │ │   MAQ 5   │  │  ... más      │
│Usuarios│ │Recomen.│ │  Pagos    │  │  servicios     │
│:8081   │ │:8091   │ │  :8083    │  │                │
└───────┘ └────────┘ └───────────┘  └────────────────┘
```

---

## 🧩 Componentes

| Componente | Tecnología | Puerto | Descripción |
|---|---|---|---|
| **Frontend** | React 18 + MUI | 80 | Interfaz de usuario y panel admin |
| **Load Balancer** | Python Flask | 8000 | Balanceo round-robin + health checks |
| **Event Monitor** | Python Flask + SocketIO | 5000 | Corazón del sistema: eventos, WebSocket, métricas |
| **Redis** | Redis 7 | 6379 | Bus de eventos Pub/Sub |
| **Usuarios** | Spring Boot + JPA | 8081 | CRUD de usuarios + auth JWT |
| **Pagos** | Spring Boot + JPA | 8083 | Gestión de pagos simulados |
| **Recomendaciones** | Spring Boot + JPA | 8091 | Catálogo y recomendaciones |
| **Circuit Breaker** | Python Flask | Por servicio | Estados CLOSED/OPEN/HALF_OPEN |
| **Replication Manager** | Python Flask | 8090 | WAL propio, quorum 2/3, failover |
| **MariaDB** | MariaDB 11.2 | 3306+ | 1 primary + 3 réplicas por servicio |

---

## 📦 Requisitos

- **Docker** 24+ con Docker Compose V2
- **Node.js** 20+ (solo para desarrollo del frontend)
- **Git**
- 5 máquinas físicas con IPs estáticas (o localhost para desarrollo)

---

## 🌐 Configuración de Red y Puertos

El sistema está diseñado para **5 máquinas físicas** con IPs estáticas.
Cada máquina ejecuta servicios específicos y necesita puertos abiertos
para comunicación entre ellas.

### 🔌 Puertos por Máquina

| Máquina | Rol | Servicios | Puertos a Abrir |
|---|---|---|---|
| **1** | Frontend Web | React + Nginx | `80 (HTTP)`, `3000 (dev)` |
| **2** | Infraestructura Central | Event Monitor Flask, Load Balancer Flask, Redis | `5000 (Event Monitor)`, `8000 (Load Balancer)`, `6379 (Redis)`, `8082 (EM alternativo)` |
| **3** | Microservicio Usuarios | Spring Boot, MariaDB 1P+3R, Replication Python | `8081 (Service)`, `3307 (DB Primary)`, `3308-3310 (DB Réplicas)`, `8090 (Replication)` |
| **4** | Microservicio Recomendaciones | Spring Boot, MariaDB 1P+3R, Replication Python | `8091 (Service)`, `3311 (DB Primary)`, `3312-3314 (DB Réplicas)`, `8091 (Replication)` |
| **5** | Microservicio Pagos | Spring Boot, MariaDB 1P+3R, Replication Python | `8083 (Service)`, `3315 (DB Primary)`, `3316-3318 (DB Réplicas)`, `8092 (Replication)` |

### 🔓 Reglas de Firewall Recomendadas

```bash
# En TODAS las máquinas — permitir tráfico interno entre el clúster
# (Reemplazar 192.168.2.0/24 con la subred real)

# Máquina 1 (Frontend)
sudo ufw allow from 192.168.2.0/24 to any port 80 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 3000 proto tcp

# Máquina 2 (Infraestructura)
sudo ufw allow from 192.168.2.0/24 to any port 5000 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 8000 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 6379 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 8082 proto tcp

# Máquina 3 (Usuarios)
sudo ufw allow from 192.168.2.0/24 to any port 8081 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 3307:3310 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 8090 proto tcp

# Máquina 4 (Recomendaciones)
sudo ufw allow from 192.168.2.0/24 to any port 8091 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 3311:3314 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 8091 proto tcp

# Máquina 5 (Pagos)
sudo ufw allow from 192.168.2.0/24 to any port 8083 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 3315:3318 proto tcp
sudo ufw allow from 192.168.2.0/24 to any port 8092 proto tcp
```

### 🆔 IDs, IPs y Roles de cada Máquina

| ID | IP Sugerida | Rol | Descripción |
|---|---|---|---|
| `1` | `192.168.2.101` | **Frontend** | Sirve la interfaz React. No tiene lógica de negocio. |
| `2` | `192.168.2.102` | **Infraestructura Central** | Corazón del sistema. Ejecuta Event Monitor (WebSocket + REST), Load Balancer y Redis. |
| `3` | `192.168.2.103` | **Microservicio Usuarios** | Registro, autenticación (JWT) y perfiles. 1 DB primaria + 3 réplicas. |
| `4` | `192.168.2.104` | **Microservicio Recomendaciones** | Catálogo de películas y recomendaciones. 1 DB primaria + 3 réplicas. |
| `5` | `192.168.2.105` | **Microservicio Pagos** | Gestión de pagos simulados. 1 DB primaria + 3 réplicas. |

### 📝 Configuración de Archivos `.env`

Antes del despliegue, editar los archivos `deployment/machine<N>/.env`
con las IPs reales de cada máquina:

```bash
# deployment/machine1/.env — Frontend (Machine 1)
MACHINE_ID=1
MACHINE_NAME="Frontend Web"
MACHINE_IP=192.168.2.101                # IP real de esta máquina
MACHINE2_IP=192.168.2.102               # IP de Máquina 2 (crítica)
REACT_APP_API_URL=http://192.168.2.102:8000    # Load Balancer
```

```bash
# deployment/machine2/.env — Infraestructura Central (Machine 2)
MACHINE_ID=2
MACHINE_NAME="Infraestructura Central"
MACHINE_IP=192.168.2.102                # IP real de esta máquina
ENABLE_EVENT_MONITOR=true
ENABLE_LOAD_BALANCER=true
ENABLE_REDIS=true
LOG_LEVEL=INFO
```

```bash
# deployment/machine3/.env — Usuarios (Machine 3)
MACHINE_ID=3
MACHINE_NAME="Microservicio Usuarios"
MACHINE_IP=192.168.2.103                # IP real de esta máquina
REDIS_HOST=192.168.2.102                # IP de Machine 2
EVENT_MONITOR_URL=http://192.168.2.102:8082  # Event Monitor en Machine 2
```

```bash
# deployment/machine4/.env — Recomendaciones (Machine 4)
MACHINE_ID=4
MACHINE_NAME="Microservicio Recomendaciones"
MACHINE_IP=192.168.2.104                # IP real de esta máquina
REDIS_HOST=192.168.2.102                # IP de Machine 2
EVENT_MONITOR_URL=http://192.168.2.102:8082  # Event Monitor en Machine 2
```

```bash
# deployment/machine5/.env — Pagos (Machine 5)
MACHINE_ID=5
MACHINE_NAME="Microservicio Pagos"
MACHINE_IP=192.168.2.105                # IP real de esta máquina
REDIS_HOST=192.168.2.102                # IP de Machine 2
EVENT_MONITOR_URL=http://192.168.2.102:8082  # Event Monitor en Machine 2
```

### 🖧 Diagrama de Conexiones entre Máquinas

```
┌─────────────────────────────────────────────────────────────────┐
│                        RED INTERNA                              │
│                     192.168.2.0/24                              │
└─────────────────────────────────────────────────────────────────┘
     │            │            │            │            │
     ▼            ▼            ▼            ▼            ▼
┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐
│ MAQ 1  │ │  MAQ 2   │ │  MAQ 3   │ │   MAQ 4    │ │ MAQ 5  │
│Frontend│ │Infraest. │ │Usuarios  │ │Recomendac. │ │ Pagos  │
│:80     │ │:5000     │ │:8081     │ │:8091       │ │:8083   │
│        │ │:8000     │ │:3307-3310│ │:3311-3314  │ │:3315-18│
│        │ │:6379     │ │:8090     │ │:8091(rep)  │ │:8092   │
└─────────┘ └──────────┘ └──────────┘ └────────────┘ └────────┘
     │            │            │            │            │
     └────────────┴────────────┴────────────┴────────────┘
                    Todos se comunican vía:
        • HTTP/WS → Machine 2 (Event Monitor :5000)
        • HTTP    → Machine 2 (Load Balancer :8000)
        • TCP     → Machine 2 (Redis :6379)
```

---

## 🚀 Despliegue Rápido

### 1. Clonar el repositorio

```bash
git clone https://github.com/your-org/distributed-streaming.git
cd distributed-streaming
chmod +x deploy.sh scripts/*.sh
```

### 2. Despliegue por máquina

```bash
# Máquina 1: Frontend
./deploy.sh 1

# Máquina 2: Infraestructura Central
./deploy.sh 2

# Máquina 3: Microservicio Usuarios
./deploy.sh 3

# Máquina 4: Microservicio Recomendaciones
./deploy.sh 4

# Máquina 5: Microservicio Pagos
./deploy.sh 5
```

### 3. Verificar instalación

```bash
# Health check de la máquina actual
./scripts/health-check.sh

# Verificación de integración completa
./scripts/verify-integration.sh

# Prueba de escenarios automatizada
./scripts/test-scenarios.sh
```

### 4. Demo guiada

```bash
# Demo paso a paso (con pausas)
./scripts/demo.sh

# Demo rápida (sin pausas)
./scripts/demo.sh --quick
```

---

## 👤 Credenciales de Acceso

### Usuarios del Sistema (Frontend)

| Usuario | Email | Contraseña | Rol |
|---|---|---|---|
| **admin** | `admin@streaming.com` | `admin123` | **ADMIN** — Acceso completo al panel `/admin` |
| **usuario1** | `usuario1@streaming.com` | `password123` | **USER** — Catálogo, perfil y pagos |
| **usuario2** | `usuario2@streaming.com` | `password123` | **USER** — Catálogo, perfil y pagos |

El usuario **admin** puede acceder a la ruta `/admin` para ver Dashboard, Heartbeats,
Replicación, Circuit Breakers, Logs, Eventos y Simulación de fallos en tiempo real.

### Bases de Datos (MariaDB)

| Recurso | Usuario | Contraseña | Bases de Datos |
|---|---|---|---|
| **Root** (todas las máquinas) | `root` | `root_secret_2024` | `streaming_usuarios`, `streaming_recomendaciones`, `streaming_pagos` |
| **App** (todas las máquinas) | `streaming` | `streaming_secret_2024` | `streaming_usuarios`, `streaming_recomendaciones`, `streaming_pagos` |

### JWT

```yaml
secret: c3RyZWFtaW5nLWRpc3RyaWJ1dGVkLXBsYXRmb3JtLWp3dC1zZWNyZXQta2V5LTIwMjQ=
expiration: 86400000ms (24 horas)
```

---

## 🔄 Diagrama de Flujo

### Creación de Usuario (Flujo Completo)

```
Cliente (Frontend)
  │
  ├─ POST /api/auth/register
  │
  ▼
Load Balancer (Machine 2)
  │
  ├─ Verifica servicio disponible (consulta Event Monitor)
  ├─ Selecciona instancia (round-robin)
  │
  ▼
Usuarios Service (Machine 3)
  │
  ├─ 1. Valida datos (JPA Validator)
  ├─ 2. Hashea password (BCrypt)
  ├─ 3. INSERT en Primary DB
  ├─ 4. Genera JWT
  │
  ├─ NOTIFICA a Replication Manager
  │   └─ POST /api/replication/log
  │
  ▼
Replication Manager (Python)
  │
  ├─ 5. Escribe en WAL (tabla replication_log)
  ├─ Polling cada 500ms
  │
  ├─ 6. Envía a Réplica 1 → espera ACK (timeout 3s)
  ├─ 7. Envía a Réplica 2 → espera ACK
  ├─ 8. Envía a Réplica 3 → espera ACK
  │
  ├─ 9. Quorum ≥ 2/3 → REPLICATED
  ├─ 10. Publica en Redis (canal "replication")
  │
  ▼
Event Monitor (Machine 2)
  │
  ├─ Recibe por Redis Pub/Sub
  ├─ Broadcasting por WebSocket
  │
  ▼
Panel Admin (Frontend)
  │
  ├─ Timeline: replicación completada
  ├─ Heartbeats: todos los nodos OK
  └─ Replicación: 3/3 ACKs
```

---

## 🔌 APIs

### Frontend → Load Balancer (Puerto 8000)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/usuarios/api/auth/register` | Registrar usuario |
| `POST` | `/api/usuarios/api/auth/login` | Iniciar sesión |
| `GET` | `/api/usuarios/api/users/me` | Perfil del usuario |
| `GET` | `/api/recomendaciones/api/recomendaciones` | Catálogo de películas |
| `GET` | `/api/recomendaciones/api/recomendaciones/featured` | Películas destacadas |
| `GET` | `/api/recomendaciones/api/recomendaciones/genre/{genre}` | Por género |
| `GET` | `/api/recomendaciones/api/recomendaciones/search?q=` | Búsqueda |
| `GET` | `/api/recomendaciones/api/recomendaciones/recommendations/user/{id}` | Recomendaciones |
| `POST` | `/api/pagos/api/pagos` | Crear pago |
| `GET` | `/api/pagos/api/pagos/user/{userId}` | Historial de pagos |
| `POST` | `/api/pagos/api/pagos/{id}/process` | Procesar pago |

### Event Monitor (Puerto 5000)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/nodes` | Listar nodos |
| `POST` | `/api/nodes/register` | Registrar nodo |
| `POST` | `/api/nodes/heartbeat` | Enviar heartbeat |
| `GET` | `/api/events` | Listar eventos |
| `POST` | `/api/events` | Crear evento |
| `GET` | `/api/metrics` | Métricas del sistema |
| `GET` | `/api/status` | Estado general |
| WebSocket | `/ws` (SocketIO) | Tiempo real |

### WebSocket (SocketIO)

| Evento | Dirección | Descripción |
|---|---|---|
| `connect` | Server → Client | Conexión establecida |
| `event` | Server → Client | Nuevo evento del sistema |
| `heartbeat` | Server → Client | Heartbeat de nodo |
| `metrics` | Server → Client | Métricas periódicas |
| `node_status` | Server → Client | Cambio de estado de nodo |
| `circuit_change` | Server → Client | Cambio de Circuit Breaker |
| `replication` | Server → Client | Evento de replicación |
| `system_status` | Server → Client | Estado general del sistema |

---

## 🎯 Escenarios de Demostración

| # | Escenario | Cómo probarlo |
|---|---|---|
| 1 | **Inicio completo de 5 máquinas** | `./deploy.sh 1` hasta `./deploy.sh 5` |
| 2 | **Registro automático de nodos** | Ver Panel Admin → Heartbeats |
| 3 | **Recepción de heartbeats** | Ver Panel Admin → Heartbeats (actualiza c/2s) |
| 4 | **Creación de usuario** | Login/Registro desde Frontend |
| 5 | **Replicación de operación** | Ver Panel Admin → Replicación |
| 6 | **Visualización de ACK** | Ver 3/3 ACKs en Replicación |
| 7 | **Balanceo de solicitudes** | `./scripts/load-test.sh` |
| 8 | **Caída de microservicio** | Panel Admin → Simulación → Detener Servicio |
| 9 | **Activación de Circuit Breaker** | Panel Admin → Simulación → Abrir CB |
| 10 | **Recuperación automática** | Esperar timeout → CB pasa a HALF_OPEN → CLOSED |
| 11 | **Restablecimiento de heartbeats** | Panel Admin → Simulación → Restaurar Heartbeat |
| 12 | **Panel en tiempo real** | Todo visible en Panel Admin |

```bash
# Ejecutar todos los escenarios automáticamente
./scripts/demo.sh

# O de forma rápida (sin pausas)
./scripts/demo.sh --quick

# Prueba específica de carga
./scripts/load-test.sh --requests=100 --concurrent=10

# Verificación de integración
./scripts/verify-integration.sh
```

---

## 📁 Estructura del Proyecto

```
distributed-streaming/
├── frontend/                          # React (Machine 1)
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── services/
│       └── styles/
├── services/                          # Spring Boot (Machines 3-5)
│   ├── usuarios/
│   ├── pagos/
│   └── recomendaciones/
├── infrastructure/                    # Python (Machines 2-5)
│   ├── event-monitor/
│   ├── load-balancer/
│   ├── circuit-breaker/
│   └── replication/
├── docker/                            # Dockerfiles
│   ├── frontend.Dockerfile
│   ├── service.Dockerfile
│   └── infrastructure.Dockerfile
├── configs/                           # Configuraciones
│   ├── event-monitor.yaml
│   ├── load-balancer.yaml
│   ├── circuit-breaker.yaml
│   ├── replication.yaml
│   └── mariadb/
├── deployment/                        # Env vars por máquina
│   ├── machine1/
│   ├── machine2/
│   ├── machine3/
│   ├── machine4/
│   └── machine5/
├── scripts/                           # Scripts de utilidad
│   ├── setup.sh
│   ├── health-check.sh
│   ├── test-scenarios.sh
│   ├── demo.sh
│   ├── load-test.sh
│   └── verify-integration.sh
├── docker-compose.yaml                # Orquestación única
├── deploy.sh                          # Despliegue unificado
├── Agent.md                           # Especificación del proyecto
└── README.md                          # Esta documentación
```

---

## 📊 Monitoreo y Observabilidad

### Panel de Administración

| Sección | Descripción | Actualización |
|---|---|---|
| **Dashboard** | Métricas generales, gráfico de actividad, estado de servicios | Tiempo real (WebSocket) |
| **Topología** | Diagrama visual de nodos con colores de estado | Cada 4s |
| **Heartbeats** | Lista de nodos con latencia y último heartbeat | Tiempo real (WebSocket) |
| **Replicación** | Estado de réplicas, ACKs, entries recientes | Tiempo real (WebSocket) |
| **Circuit Breakers** | Estados CLOSED/OPEN/HALF_OPEN por servicio | Tiempo real (WebSocket) |
| **Logs** | Todos los eventos filtrables por nivel/servicio/búsqueda | Tiempo real (WebSocket) |
| **Eventos** | Timeline animado con pausa/reanudar | Tiempo real (WebSocket) |
| **Simulación** | Botones para disparar fallos controlados | Manual |

### Colores de Estado

- 🟢 **Online/Active**: Servicio funcionando correctamente
- 🟡 **Warning/Degraded**: Latencia alta o errores intermitentes
- 🔴 **Offline/Inactive**: Servicio no responde

---

## ⚙ Simulación de Fallos

El Panel Admin incluye una sección de simulación que permite:

| Acción | Efecto en el sistema |
|---|---|
| **Detener Servicio** | Event Monitor registra heartbeat perdido |
| **Reiniciar Servicio** | Se restaura el heartbeat |
| **Perder Heartbeat** | Nodo marca como warning → offline |
| **Restaurar Heartbeat** | Nodo vuelve a online |
| **Abrir Circuit Breaker** | Estado CLOSED → OPEN (rechaza solicitudes) |
| **Cerrar Circuit Breaker** | Estado OPEN → CLOSED (restaura tráfico) |
| **Fallo Réplica** | Réplica marca offline, quorum cae a 2/3 |
| **Recuperar Réplica** | Réplica se reincorpora |
| **Latencia Alta** | Simula latencia de red > 500ms |

---

## 🛠 Scripts de Utilidad

```bash
# Configuración inicial (una vez por máquina)
./scripts/setup.sh

# Health check del sistema
./scripts/health-check.sh        # Máquina actual
./scripts/health-check.sh 2      # Máquina específica
./scripts/health-check.sh all    # Todas las máquinas

# Pruebas automatizadas
./scripts/test-scenarios.sh      # 12 escenarios
./scripts/test-scenarios.sh --verbose

# Demo guiada
./scripts/demo.sh                # Con pausas
./scripts/demo.sh --quick        # Sin pausas

# Prueba de carga
./scripts/load-test.sh
./scripts/load-test.sh --requests=100 --concurrent=10

# Verificación de integración
./scripts/verify-integration.sh
./scripts/verify-integration.sh --verbose
```

---

## 🔐 Seguridad

- **Autenticación**: JWT (JSON Web Tokens)
- **Roles**: `USER` (usuario normal) y `ADMIN` (acceso a panel)
- **Passwords**: Hasheadas con BCrypt en Spring Boot
- **CORS**: Configurado para comunicación entre máquinas
- **JWT Secret**: Configurable vía variable de entorno

---

## 📈 Métricas Clave

| Métrica | Cómo se mide | Dónde se ve |
|---|---|---|
| Heartbeats recibidos | Contador en Event Monitor | Panel Admin → Heartbeats |
| Latencia de replicación | Timestamp entre envío y ACK | Panel Admin → Replicación |
| Estado de Circuit Breaker | Máquina de estados CLOSED/OPEN/HALF_OPEN | Panel Admin → Circuit Breakers |
| Eventos por segundo | Conteo en ventana de 1 minuto | Dashboard |
| Nodos activos | Heartbeats en los últimos 10s | Dashboard + Heartbeats |
| Tasa de ACK | ACKs recibidos / operaciones totales | Replicación |

---

## 🧪 Desarrollo Local

```bash
# Frontend standalone
cd frontend
npm install
npm start                      # http://localhost:3000

# Infraestructura (con Docker)
docker compose --profile machine2 up -d

# Verificar
curl http://localhost:5000/health
curl http://localhost:8000/health
```

---

## 📝 Notas Técnicas

- **No usa Galera**: La replicación es implementada por el Replication Manager en Python con WAL propio y quorum 2/3
- **No hay streaming real**: El catálogo contiene metadatos de películas con botón de reproducción simulado
- **Redis como bus de eventos**: Nunca como simple caché — todos los eventos viajan por Pub/Sub
- **Observabilidad completa**: No es necesario abrir terminales durante la demostración
- **Arquitectura limpia**: Componentes desacoplados, configuración por entorno, principios SOLID
