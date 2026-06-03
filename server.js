const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render asigna el puerto dinámicamente mediante la variable de entorno PORT
const PORT = process.env.PORT || 3000;

// Estructura de métricas temporal en memoria (No persistente en disco para Render gratuito)
let datosHistoricos = {};

// Registro automatizado de conexiones cada 5 minutos
setInterval(() => {
    const fecha = new Date();
    // Forzamos zona horaria de Argentina para consistencia en los reportes del show
    const argentinaTime = new Date(fecha.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    
    const año = argentinaTime.getFullYear();
    const mes = String(argentinaTime.getMonth() + 1).padStart(2, '0');
    const dia = String(argentinaTime.getDate()).padStart(2, '0');
    const fechaClave = `${año}-${mes}-${dia}`;
    
    const horaClave = String(argentinaTime.getHours()).padStart(2, '0') + ':00';
    const conectadosAhora = io.sockets.sockets.size || 0; 

    if (!datosHistoricos[fechaClave]) {
        datosHistoricos[fechaClave] = {};
    }
    
    const registroActual = datosHistoricos[fechaClave][horaClave] || 0;
    datosHistoricos[fechaClave][horaClave] = Math.max(registroActual, conectadosAhora);

}, 60000 * 5);

// ==========================================
// CAPA DE SEGURIDAD - AUTENTICACIÓN BASIC
// ==========================================
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard Protegido Tecnoincas"');
        return res.status(401).send('Se requiere autenticación para ingresar.');
    }

    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const usuario = auth[0];
    const clave = auth[1];

    if (usuario === 'admin' && clave === 'Tecnoincas2026') {
        next(); 
    } else {
        res.setHeader('WWW-Authenticate', 'Basic realm="Dashboard Protegido Tecnoincas"');
        return res.status(401).send('Credenciales incorrectas.');
    }
};

// ==========================================
// RUTAS DEL SISTEMA NUBE
// ==========================================

// API de métricas protegida
app.get('/api/metrics-data', authMiddleware, (req, res) => {
    const conectadosAhora = io.sockets.sockets.size || 0;
    res.json({
        actual: conectadosAhora,
        historico: datosHistoricos
    });
});

// Dashboard protegido
app.get('/dashboard', authMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Servir archivos estáticos de la carpeta pública (pantalla.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// LÓGICA DE WEBSOCKETS (SOCKET.IO MULTI-CLIENTE)
// ==========================================
io.on('connection', (socket) => {
    
    // Al conectarse un dispositivo, notificamos el nuevo total de inmediato
    io.emit('usuariosConectados', io.sockets.sockets.size);

    // Reenvio de eventos del Show en tiempo real
    socket.on('cambiarColor', (data) => {
        io.emit('cambiarColor', data);
    });

    socket.on('modoBomboServidor', (data) => {
        io.emit('modoBomboServidor', data);
    });

    socket.on('registroGolpeLED', () => {
        io.emit('registroGolpeLED');
    });

    socket.on('disconnect', () => {
        // Al desconectarse, actualizamos el número de la audiencia
        io.emit('usuariosConectados', io.sockets.sockets.size);
    });
});

// Inicio de la app
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 SERVIDOR NUBE DESPLEGADO EXITOSAMENTE`);
    console.log(`📊 URL PRODUCCIÓN: https://tecnoluces.onrender.com`);
    console.log(`==================================================`);
});