const express = require('express')
const WebSocketServer = require('ws').Server
const app = express()
const nunjucks = require('nunjucks')
const Boggle = require('solve-boggle')

const webPort = 8080
const wsPort = 8081

let rooms = {}
const wss = new WebSocketServer({ port: wsPort })

function createRoom(size, time) {
    // generate random string
    let id = Math.floor(Math.random()*10000)
    // create room
    rooms[id] = {
        id: id,
        players: [],
        board: null,
        wordList: null,
        boardSize: size,
        active: false,
        gameTime: time
    }
    return id
}

function setRoomActive(id) {
    let room = rooms[id]
    room.active = true
    room.board = new Boggle(parseInt(room.boardSize))

    room.board.solve((wordList) => {
        room.wordList = wordList
    })

    //room.boardSize = room.board.length
    // send board to all players
    room.players.forEach(player => {
        player.send(JSON.stringify({
            type: 'start',
            board: room.board,
            wordList: room.wordList,
            boardSize: room.boardSize,
            timer: room.gameTime
        }))
    })
}

function setRoomInactive(id) {
    console.log("shutting down room " + id)
    let room = rooms[id]
    room.active = false
    room.board = null
    room.wordList = null
    room.boardSize = null

    // send board to all players
    //console.log(rooms[id])
    room.players.forEach(player => {
        player.send(JSON.stringify({
            type: 'end',
            board: room.board,
            wordList: room.wordList,
            boardSize: room.boardSize,
        }))
    })
}



nunjucks.configure('views', {
    autoescape: true,
    express: app
})

app.get('/', (req, res) => {
  res.render('index.html')
})

app.get('/room', (req, res) => {
    res.render('room.html', { room: req.query.room })
})

app.get('/create-room', (req, res) => {
    if (req.query.size == "") {
        req.query.size = 4
    }
    if (req.query.time == "") {
        req.query.time = 2*60
    }
    res.redirect('/room?room=' + createRoom(req.query.size, req.query.time))
})

wss.on('connection', function connection(ws) {
    console.log('new connection')
    ws.on('message', function message(data) {
        console.log('received: %s', data)
        let message = JSON.parse(data)
        if (message.type === 'join') {
            let room = rooms[message.room]
            //console.log(room)
            if (room.active) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Room is already active'
                }))
            } else {
                room.players.push(ws)
                ws.send(JSON.stringify({
                    type: 'join',
                    room: room.id,
                    board: room.board,
                    wordList: room.wordList,
                }))
            }
        }
        if (message.type === 'start') {
            let room = rooms[message.room]
            if (room.active) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Room is already active'
                }))
            } else {
                setRoomActive(message.room)
                setTimeout(function(){
                    setRoomInactive(message.room)
                }, parseInt(room.gameTime)*1000)
            }
        }
        if (message.type === 'guess') {
            let room = rooms[message.room]
            if (room.active) {
                let word = message.word
                let board = room.board
                console.log(room)
                let wordList = room.wordList
                if (wordList.includes(word.toUpperCase())) {
                    ws.send(JSON.stringify({
                        boardSize: room.boardSize,
                        type: 'guess',
                        word: word,
                        correct: true
                    }))
                } else {
                    ws.send(JSON.stringify({
                        boardSize: room.boardSize,
                        type: 'guess',
                        word: word,
                        correct: false
                    }))
                }
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Room is not active'
                }))
            }
        }

    })
  
    //ws.send('something')
})
  

app.listen(port, () => {
    console.log(`webserver on port ${webPort}`)
    console.log(`ws on port ${wsPort}`)
})

