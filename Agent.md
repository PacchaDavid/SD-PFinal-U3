# AGENT.md

# Proyecto: Plataforma Distribuida de Streaming (Proyecto Académico)

## Rol del Agente

Eres el arquitecto e ingeniero principal del proyecto. Tu objetivo NO es desarrollar una plataforma comercial de streaming, sino construir un sistema distribuido demostrable académicamente.

El dominio del proyecto es un servicio tipo Netflix, pero únicamente sirve como contexto. La prioridad absoluta es demostrar conceptos de computación distribuida, tolerancia a fallos, monitoreo, replicación, balanceo de carga y despliegue distribuido.

El sistema debe priorizar:

- Arquitectura distribuida
- Observabilidad
- Simulación de fallos
- Replicación
- Heartbeats
- Alta disponibilidad
- Despliegue automático
- Panel de administración en tiempo real

La interfaz de usuario únicamente servirá para demostrar el funcionamiento de la infraestructura.

---

# Objetivos del proyecto

El sistema debe demostrar visualmente:

- Comunicación distribuida entre cinco máquinas físicas.
- Balanceo de solicitudes.
- Circuit Breaker.
- Heartbeats.
- Replicación entre nodos.
- Estado de servicios.
- Estado de bases de datos.
- Eventos del sistema.
- Logs centralizados.
- Estado de Redis.
- Latencias.
- Recuperación ante fallos.
- Observabilidad completa desde una interfaz web.

Durante la demostración NO debe ser necesario observar terminales para verificar el funcionamiento del sistema.

Toda la información deberá visualizarse desde el panel web.

---

# Restricciones Tecnológicas

## Frontend

React

## Backend de Microservicios

Java
Spring Boot

## Componentes de Infraestructura

Python

Estos incluyen:

- Load Balancer
- Circuit Breaker
- Event Monitor
- Replication Manager

## Base de Datos

MariaDB

## Cache y Eventos

Redis

## Contenedores

Docker

Docker Compose

---

# Arquitectura Física

El sistema funcionará sobre cinco máquinas físicas distintas.

Cada máquina tendrá una IP estática.

El despliegue será automático mediante un único repositorio.

Cada máquina ejecutará únicamente los componentes que le correspondan.

---

# Máquina 1

Frontend Web

Debe contener:

- Interfaz de Usuario
- Interfaz de Administración
- Cliente WebSocket
- Cliente REST

No contendrá lógica de negocio.

---

# Máquina 2

Infraestructura Central

Componentes:

Load Balancer (Python)

Event Monitor (Python)

Redis

Registro de Nodos

Health Checker

Heartbeat Manager

Gestor de Eventos

Esta máquina representa el corazón del sistema.

Todo componente deberá reportar información aquí.

---

# Máquina 3

Microservicio Usuarios

Java Spring Boot

Componentes:

Usuarios Service

Circuit Breaker

Replica MariaDB 1

Replica MariaDB 2

Replica MariaDB 3

Replication Manager

---

# Máquina 4

Microservicio Recomendaciones

Java Spring Boot

Componentes:

Recomendaciones Service

Circuit Breaker

Replica MariaDB 1

Replica MariaDB 2

Replica MariaDB 3

Replication Manager

---

# Máquina 5

Microservicio Pagos

Java Spring Boot

Componentes:

Pagos Service

Circuit Breaker

Replica MariaDB 1

Replica MariaDB 2

Replica MariaDB 3

Replication Manager

---

# Organización del Repositorio

```
distributed-streaming/

frontend/

services/
    usuarios/
    pagos/
    recomendaciones/

infrastructure/
    event-monitor/
    load-balancer/
    circuit-breaker/
    replication/

docker/

configs/

deployment/
    machine1/
    machine2/
    machine3/
    machine4/
    machine5/

scripts/

docker-compose.yaml

deploy.sh

README.md
```

No deberán existir múltiples repositorios.

Todo el proyecto deberá encontrarse en uno solo.

---

# Despliegue

El sistema completo deberá desplegarse mediante un único script.

Ejemplo

```
./deploy.sh 1
```

Debe iniciar únicamente los servicios de la Máquina 1.

```
./deploy.sh 2
```

Debe iniciar únicamente los servicios de la Máquina 2.

Y así sucesivamente.

El script deberá:

- Detectar el ID de máquina.
- Leer el archivo .env correspondiente.
- Configurar Docker Compose.
- Iniciar únicamente los servicios correspondientes.
- Configurar variables de entorno.
- Registrar el nodo en el Event Monitor.

---

# Docker Compose

Existirá un único docker-compose.yaml.

La activación de componentes dependerá de variables de entorno.

No deberán existir cinco docker-compose diferentes.

---

# Comunicación

Frontend

↓

HTTP REST

↓

Load Balancer

↓

Microservicios

Los eventos deberán viajar mediante Redis.

El panel de administración deberá utilizar WebSocket.

---

# Microservicios

Usuarios

Operaciones:

- Crear usuario
- Editar usuario
- Eliminar usuario
- Consultar usuarios

---

Pagos

Operaciones:

- Registrar pago
- Consultar historial
- Simular aprobación
- Simular rechazo

No se utilizarán pasarelas reales.

---

Recomendaciones

Operaciones:

- Obtener recomendaciones
- Historial
- Catálogo

Las recomendaciones pueden ser simuladas.

---

# Streaming

No existirán películas reales.

El catálogo contendrá únicamente:

Poster

Título

Descripción

Duración

Categoría

Botón Reproducir

El botón simplemente abrirá una pantalla indicando que la reproducción ha iniciado.

No deberá implementarse streaming multimedia.

---

# Replicación

NO utilizar Galera.

NO utilizar replicación automática de MariaDB.

Debe implementarse un módulo propio de replicación.

Este componente deberá desarrollarse en Python.

---

# Funcionamiento esperado

Cada microservicio tendrá un nodo principal.

Además tendrá tres contenedores MariaDB.

Cada operación de escritura deberá seguir el flujo:

Cliente

↓

Microservicio

↓

Primary

↓

Replication Manager

↓

Replica 1

↓

ACK

↓

Replica 2

↓

ACK

↓

Replica 3

↓

ACK

↓

Operación confirmada

---

# Información de replicación

El sistema deberá mostrar:

Estado

Última sincronización

ACK recibidos

Tiempo

Latencia

Estado de cada réplica

Número de escrituras

Número de lecturas

---

# Heartbeats

Todos los componentes deberán enviar un heartbeat cada dos segundos.

El Event Monitor almacenará:

Nodo

Hora

Estado

Última respuesta

Tiempo sin responder

---

# Event Monitor

Este componente representa el núcleo del sistema.

Debe recibir información de todos los servicios.

No deberá depender de la consola.

Toda la información deberá exponerse mediante APIs y WebSocket.

---

# Eventos

Todo componente deberá reportar eventos.

Ejemplos

Servicio iniciado

Servicio detenido

Solicitud recibida

Solicitud procesada

Replica enviada

Replica confirmada

Circuit Breaker abierto

Circuit Breaker cerrado

Heartbeat recibido

Heartbeat perdido

Nodo recuperado

Nodo desconectado

Latencia alta

---

# Logs

Todos los eventos deberán almacenarse.

Los logs deberán consultarse desde el panel web.

No desde la consola.

---

# Redis

Redis será utilizado para:

Bus de eventos

Publicación de heartbeats

Distribución de eventos

Notificaciones

Sincronización

Nunca como simple caché.

---

# Load Balancer

Implementado en Python.

Responsabilidades:

Balancear solicitudes.

Detectar servicios disponibles.

No enviar tráfico a nodos caídos.

Consultar el Event Monitor antes de redirigir tráfico.

Registrar métricas.

---

# Circuit Breaker

Implementado en Python.

Estados:

CLOSED

OPEN

HALF OPEN

Toda transición deberá notificarse al Event Monitor.

---

# Observabilidad

Toda la infraestructura deberá ser observable desde el frontend.

Nunca depender de terminales.

---

# Panel de Administración

Debe ser el componente más importante del proyecto.

Debe mostrar en tiempo real:

## Estado General

Servicios activos

Servicios caídos

Tiempo activo

Uso de CPU

Uso de memoria

Estado de Redis

Estado del Load Balancer

---

## Topología

Visualización gráfica de:

Frontend

↓

Load Balancer

↓

Servicios

↓

Bases de Datos

↓

Réplicas

Los nodos deberán cambiar de color dependiendo de su estado.

---

## Heartbeats

Lista en tiempo real.

Cada nodo mostrará:

Último heartbeat

Estado

Tiempo de respuesta

---

## Replicación

Cada microservicio deberá mostrar:

Nodo principal

Réplicas

Estado

Sincronización

ACK

Latencia

Número de operaciones

---

## Circuit Breakers

Estado actual.

Historial.

Tiempo abierto.

Tiempo cerrado.

---

## Logs

Tabla filtrable.

Búsqueda.

Nivel.

Servicio.

Hora.

Descripción.

---

## Eventos

Timeline del sistema.

Debe actualizarse en tiempo real mediante WebSocket.

---

## Latencias

REST

Redis

Replicación

Base de Datos

WebSocket

---

## Redis

Estado

Clientes conectados

Eventos por segundo

Uso de memoria

---

# Panel de Usuario

Login

Registro

Catálogo

Películas

Recomendaciones

Pagos

Perfil

No deberá contener funciones avanzadas.

---

# Simulación de Fallos

El panel de administración deberá permitir:

Detener un servicio.

Reiniciar un servicio.

Simular pérdida de heartbeat.

Simular alta latencia.

Simular fallo de una réplica.

Simular recuperación.

Abrir un Circuit Breaker.

Cerrar un Circuit Breaker.

Estas acciones deberán actualizar el sistema en tiempo real.

---

# Seguridad

JWT

Roles

ADMIN

USER

---

# APIs

Todos los microservicios deberán exponer:

Health

Metrics

Heartbeat

Status

Events

Además de sus APIs funcionales.

---

# Calidad del Código

Todo componente deberá estar desacoplado.

Arquitectura limpia.

Código documentado.

Uso de principios SOLID cuando sea aplicable.

Manejo adecuado de excepciones.

Configuración mediante variables de entorno.

No utilizar rutas absolutas.

---

# Interfaces Modernas

La interfaz deberá ser moderna.

Responsive.

Modo oscuro.

Actualización en tiempo real.

Uso de gráficos.

Uso de indicadores visuales.

Uso de colores para estados.

Verde

Amarillo

Rojo

---

# Escenarios de Demostración

El sistema deberá permitir demostrar fácilmente:

1.
Inicio completo de las cinco máquinas.

2.
Registro automático de nodos.

3.
Recepción de heartbeats.

4.
Creación de un usuario.

5.
Replicación de la operación.

6.
Visualización de ACK.

7.
Balanceo de solicitudes.

8.
Caída de un microservicio.

9.
Activación del Circuit Breaker.

10.
Recuperación automática.

11.
Restablecimiento de heartbeats.

12.
Actualización del panel en tiempo real.

Todo sin necesidad de observar una consola.

---

# Prioridad de Desarrollo

El agente deberá implementar el proyecto siguiendo estrictamente este orden:

Fase 1

Infraestructura base.

Repositorio.

Docker.

Despliegue.

Comunicación.

---

Fase 2

Event Monitor.

Heartbeats.

Registro de nodos.

Redis.

WebSocket.

---

Fase 3

Load Balancer.

Circuit Breaker.

---

Fase 4

Microservicios.

Usuarios.

Pagos.

Recomendaciones.

---

Fase 5

Motor de replicación.

---

Fase 6

Frontend Usuario.

---

Fase 7

Panel de Administración.

---

Fase 8

Pruebas distribuidas.

Simulación de fallos.

Optimización.

---

# Criterio Fundamental

El objetivo principal NO es desarrollar un clon de Netflix.

El verdadero objetivo consiste en demostrar una arquitectura distribuida funcional, observable, tolerante a fallos y desplegable automáticamente sobre cinco máquinas físicas mediante un único repositorio y un único mecanismo de despliegue.