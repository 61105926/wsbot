#!/bin/bash

# Script de utilidades para logs y envíos

# Función para ver logs de hoy
logs_hoy() {
    echo "=== LOGS DE BOLETAS HOY ==="
    if [ -f "logs/payslips_$(date +%Y-%m-%d).log" ]; then
        cat "logs/payslips_$(date +%Y-%m-%d).log"
    else
        echo "No hay logs de boletas para hoy"
    fi

    echo -e "\n=== LOGS DE MENSAJES MASIVOS HOY ==="
    if [ -f "logs/bulk_messages_$(date +%Y-%m-%d).log" ]; then
        cat "logs/bulk_messages_$(date +%Y-%m-%d).log"
    else
        echo "No hay logs de mensajes masivos para hoy"
    fi
}

# Función para enviar boletas masivas
enviar_boletas() {
    if [ -z "$1" ]; then
        echo "Uso: enviar_boletas <mes>"
        echo "Ejemplo: enviar_boletas 2024-09"
        return 1
    fi

    echo "¿Está seguro de enviar boletas masivas del mes $1? (y/N)"
    read -r respuesta

    if [[ $respuesta =~ ^[Yy]$ ]]; then
        curl -X POST http://localhost:3008/sendBulkPayslips \
          -H "Content-Type: application/json" \
          -d "{\"month\": \"$1\", \"authorize\": true}"
        echo -e "\n✅ Proceso iniciado. Use 'estado_cola' para monitorear."
    else
        echo "❌ Envío cancelado"
    fi
}

# Función para ver estado de la cola
estado_cola() {
    echo "=== ESTADO DE LA COLA ==="
    curl -s http://localhost:3008/status
    echo ""
}

# Función para detener envíos
detener_envios() {
    echo "¿Está seguro de detener todos los envíos en cola? (y/N)"
    read -r respuesta

    if [[ $respuesta =~ ^[Yy]$ ]]; then
        curl -X POST http://localhost:3008/stop
        echo -e "\n✅ Envíos detenidos"
    else
        echo "❌ Operación cancelada"
    fi
}

# Función para seguir logs en tiempo real
seguir_logs() {
    echo "Siguiendo logs en tiempo real (Ctrl+C para salir)..."
    echo "=== LOGS DE BOLETAS ==="
    tail -f "logs/payslips_$(date +%Y-%m-%d).log" 2>/dev/null &
    PID1=$!

    echo "=== LOGS DE MENSAJES MASIVOS ==="
    tail -f "logs/bulk_messages_$(date +%Y-%m-%d).log" 2>/dev/null &
    PID2=$!

    # Esperar Ctrl+C
    trap "kill $PID1 $PID2 2>/dev/null; exit" INT
    wait
}

# Mostrar ayuda
ayuda() {
    echo "=== COMANDOS DISPONIBLES ==="
    echo "logs_hoy          - Ver logs del día actual"
    echo "enviar_boletas    - Enviar boletas masivas (requiere mes)"
    echo "estado_cola       - Ver estado de la cola de envíos"
    echo "detener_envios    - Detener todos los envíos en cola"
    echo "seguir_logs       - Seguir logs en tiempo real"
    echo "ayuda             - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  enviar_boletas 2024-09"
    echo "  logs_hoy"
    echo "  estado_cola"
}

# Si se llama el script sin argumentos, mostrar ayuda
if [ $# -eq 0 ]; then
    ayuda
fi