if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}
const express = require('express')
const app = express()
const port = process.env.PORT || 8989
const http = require('http').createServer(app)
const io = require('socket.io')(http)
const path = require('path')
const session = require('express-session')
const mongoose = require('mongoose')
const mongodbstore = require('connect-mongodb-session')(session)
const morgan = require('morgan')
const multer = require('multer')
const uploader = multer()
const helmet = require('helmet')
const cors = require('cors')
const xs = require('xss')
const csrf = require('csurf')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const rfs = require('rotating-file-stream')
const sharedsession = require('express-socket.io-session')
const route = require('./routes/index')
const admin = require('./routes/admin')
const {ftp: ftp} = require('./routes/functions') 
//models 
const election = require('./models/election')
const users = require('./models/user')
mongoose.connect(process.env.db_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
const store = new mongodbstore({
    uri: process.env.db_url,
    collection: 'sessions'
})

store.on('error', (err) => {
    console.log(err)
})
const dir = path.join(__dirname, './public')
const log_stream = rfs.createStream('logs.log', {
    interval: '1d',
    path: path.join(__dirname, 'log')
})
const appsession = session({
    name: "wmsu-session-id",
    secret: process.env.session_secret,
    expires: 1000 * 60 * 60 * 24,
    cookie: {
       maxAge: 1000 * 60 * 60 * 24 * 1, 
       httpOnly: true, 
       sameSite: 'strict'
    },
    store: store,
    resave: false,
    saveUninitialized: true,
    connectionOptions: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000
    }
})
app.use(
    helmet({
        contentSecurityPolicy: false,
    })
)
app.use(morgan(':status :remote-addr :method :url :response-time ms', { stream: log_stream }))
app.use(express.static(dir))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json()) // json 
app.use(uploader.array())
app.use(cors())
app.set('view engine', 'ejs')
if(app.get('env') === 'production'){
    app.set('trust proxy', 1)
} 
app.use(cookieParser())
app.use(csrf({cookie: true}))
app.use(appsession)
app.use(route) //all user req
app.use(admin) //all admin req 
//http 404 req
app.use(function(req, res, next) { 
    res.status(404).render('error/404')
})
io.use(sharedsession(appsession, {
    autoSave: true,
    resave: true, 
    saveUninitialized: true
}))
//socket.io admin & user namespace 
const admin_socket = io.of("/admin")
const users_socket = io.of("/users") 
admin_socket.use(sharedsession(appsession, {
    autoSave: true,
    resave: true, 
    saveUninitialized: true
}))
users_socket.use(sharedsession(appsession, {
    autoSave: true,
    resave: true, 
    saveUninitialized: true
}))
//admin websocket events
admin_socket.on('connection', (socket) => {
    //election events
    //if admin requests updated data of election 
    socket.on('election-data', async (data, res) => {
        let new_election_data = {
            voters: {
                accepted: 0, 
                pending: 0, 
                voted: 0
            },
            candidates: {
                accepted: 0, 
                pending: 0, 
                deleted: 0
            },
            partylists: 0, 
            positions: 0
        }
        try {
            await election.find({_id: {$eq: xs(data.id)}}).then( (elec) => {
                const election = elec.length === 0 ? [] : elec[0]
                //accepeted voters 
                for(let i = 0; i < election.voters.length; i++){
                    if(election.voters[i].status === 'Accepted'){
                        new_election_data.voters.accepted += 1
                    }
                    if(election.voters[i].status === 'Pending'){
                        new_election_data.voters.pending += 1
                    }
                } 
                //accepeted candidates 
                for(let i = 0; i < election.candidates.length; i++){
                    if(election.candidates[i].status === 'Accepted'){
                        new_election_data.candidates.accepted += 1
                    }
                    if(election.candidates[i].status === 'Pending'){
                        new_election_data.candidates.pending += 1
                    }
                    if(election.candidates[i].status === 'Deleted'){
                        new_election_data.candidates.deleted += 1
                    }
                } 
                //voters voted 
                for(let i = 0; i < election.voters.length; i++){
                    if(election.voters[i].voted){
                        new_election_data.voters.voted += 1
                    }
                }
                new_election_data.partylists = election.partylist.length
                new_election_data.positions = election.positions.length
                res({
                    status: true, 
                    data: new_election_data
                })
            }).catch( (e) => {
                throw new Error(e)
            })
        } catch (e){
            console.log(e)
            res({
                status: false, 
                msg: e
            })
        }
    })
    socket.on('voter-accepted', async (data, res) => {
       //get voter socket id  
       await users.find({_id: {$eq: xs(data.voterID)} }, {socket_id: 1}).then( (v) => {
            const socket_id = v.length === 0 ? '' : v[0].socket_id 
            if(socket_id !== ''){
                users_socket.to(socket_id).emit('voter-accepted')
            }
        }).catch( (e) => {
            console.error(e.message)
        })
    })
})
//user websocket events
users_socket.on('connection', async (socket) => {
    const {myid} = socket.handshake.session 
    //update socket id every user connted to server 
    await users.updateOne({_id: {$eq: xs(myid)}}, {$set: {socket_id: socket.id}}).then( (s) => {
        users_socket.to(socket.id).emit('user-connected', {id: myid, socket_id: socket.id})
    }).catch( (e) => {
        users_socket.to(socket.id).emit('error', {msg: e.message})
    })
})
start()
async function start() {
    http.listen(port, console.log('Server Started on port ' + port))
    // if (process.env.NODE_ENV !== 'production') {
    //     http.listen(port, console.log('Server Started on port ' + port))
    // }
    // else{
    //     console.log("Connecting to FTP Server \n")
    //     if (await ftp()) {
    //         http.listen(port, console.log('Server Started on port ' + port))
    //         console.log("Connected to FTP Server \n")
    //     } else {
    //         //retry to connect 
    //         console.log("Can't connect to FTP Server \n")
    //         console.log("Reconnecting \n")
    //         http.listen(port, console.log('Server Started on port ' + port))
    //     }
    // }
}
