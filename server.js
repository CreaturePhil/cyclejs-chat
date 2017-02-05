const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const path = require('path')

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

io.on('connection', (socket) => {
  socket.on('chat message', (data) => {
    io.emit('chat message', data)
  })
})

server.listen(3000, () => {
  console.log('Listening on port 3000...')
})
