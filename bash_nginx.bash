#!/bin/bash

# Instalar Nginx
echo "Instalando Nginx..."
apt update
apt install nginx -y

# Verificar si Nginx se instaló correctamente
if [ $? -eq 0 ]; then
  echo "Nginx se ha instalado correctamente."
else
  echo "Hubo un problema al instalar Nginx. Por favor, revisa los logs para más detalles."
  exit 1
fi

# Inicial el servicio de Nginx
sudo systemctl start nginx

# Habilitar Nginx para que se incie automaticamente en el arranque
sudo systemctl enable nginx

# Comprobar si el servicio se esta ejecutando
if systemctl is-active --quiet nginx; then
  echo "Nginx se esta ejecutando correctamente"
else
  echo "Ha ocurrido un error al inciar Nginx. Por favor, comprueba los registros para más detalles."
  exit 1
fi

# Mensaje final
echo "La instalacion de Nginx se ha completado correctamente."
echo "Ingresa a la direccion publica de tu IP para comprobar"

exit 0