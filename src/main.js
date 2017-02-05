import xs from 'xstream'
import {run} from '@cycle/xstream-run'
import {makeDOMDriver, div, input, label} from '@cycle/dom'
import io from 'socket.io-client'

function intent({DOM, Socket}) {
  const message$ = DOM.select('.message-input').events('change')

  const elem$ = message$
    .map(ev => ev.target)

  const addMessage$ = message$
    .map(ev => ev.target.value)
    .filter(val => val.trim())
    .map(val => ({eventName: 'chat message', data: val}))

  const newMessage$ = Socket.events('chat message')

  return {elem$, addMessage$, newMessage$}
}

function model(actions) {
  const messages$ = actions.newMessage$
    .map(message => state =>
      Object.assign({}, state, {messages: state.messages.concat(message)})
    )

  const state$ = messages$
    .fold((state, action) => action(state), {messages: []})
    .startWith({messages: []})

  return state$
}

function view(state$) {
  return state$.debug('ho').map(state =>
    div([
      div([
        label('Username: '),
        input({attrs: {type: 'text'}})
      ]),
      div(state.messages.map(message =>
        div([message])
      )),
      div([
        input('.message-input', {attrs: {type: 'text'}})
      ])
    ])
  )
}

function main(sources) {
  const actions = intent(sources)
  const vdom$ = view(model(actions))

  return {
    DOM: vdom$,
    Socket: actions.addMessage$,
    ClearInput: actions.elem$
  }
}

function makeClearInputDriver() {
  function ClearInputDriver(elem$) {
    elem$.addListener({
      next(elem) { elem.value = '' },
      error(err) { console.error(err) },
      complete() {}
    })
  }
  return ClearInputDriver
}

function makeSocketDriver(url) {
  const socket = io(url)
  function SocketDriver(outgoing$) {
    outgoing$.addListener({
      next(outgoing) {
        socket.emit(outgoing.eventName, outgoing.data)
      },
      error() {},
      complete() {}
    })
    return {
      events(name) {
        return xs.create({
          start(listener) {
            socket.on(name, data => listener.next(data))
          },
          stop() {}
        })
      }
    }
  }
  return SocketDriver;
}

const drivers = {
  DOM: makeDOMDriver('#app'),
  ClearInput: makeClearInputDriver(),
  Socket: makeSocketDriver()
}

run(main, drivers)
