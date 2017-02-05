import xs from 'xstream'
import {run} from '@cycle/xstream-run'
import {makeDOMDriver, div, input, label} from '@cycle/dom'
import debounce from 'xstream/extra/debounce'
import io from 'socket.io-client'

function intent({DOM, Socket}) {
  const message$ = DOM.select('.message-input').events('change')

  const elem$ = message$
    .map(ev => ev.target)

  const addMessage$ = message$
    .map(ev => ev.target.value)
    .filter(val => val.trim())

  const newMessage$ = Socket.events('chat message')

  const changeUsername$ = DOM.select('.username').events('input')
    .compose(debounce(500))
    .map(ev => ev.target.value)
    .filter(val => val.length > 0)

  return {elem$, addMessage$, newMessage$, changeUsername$}
}

function model(actions) {
  const messages$ = actions.newMessage$
    .map(message => state =>
      Object.assign({}, state, {messages: state.messages.concat(message)})
    )

  const username$ = actions.changeUsername$
    .map(username => state =>
      Object.assign({}, state, {username})
    )

  const state$ = xs.merge(messages$, username$)
    .fold((state, action) => action(state), {messages: [], username: ''})
    .startWith({messages: [], username: ''})

  return state$
}

function view(state$) {
  return state$.map(state =>
    div([
      div([
        label('Username: '),
        input('.username', {attrs: {type: 'text'}}),
        state.username
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

  const socket$ = xs.combine(actions.addMessage$, actions.changeUsername$)
    .map(([message, username]) =>
      ({eventName: 'chat message', data: `${username}: ${message}`})
    )

  return {
    DOM: vdom$,
    Socket: socket$,
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
