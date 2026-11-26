const fs = require('fs');
const path = require('path');

const clientJsPath = path.join(__dirname, 'node_modules/whatsapp-web.js/src/Client.js');

if (!fs.existsSync(clientJsPath)) {
  console.log('patch-wwebjs: whatsapp-web.js Client.js not found, skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(clientJsPath, 'utf8');
let modified = false;

// 1. Patch WAWebSocketModel check in inject() so it doesn't crash on non-login route
const badInjectRouteTarget = `                const loginRoute =
                    window.location.pathname.startsWith('/login');
                let Socket = null;
                if (loginRoute) {
                    Socket = window.require(
                        'WAWebBackendEventBus',
                    ).BackendEventBus;
                    Socket.hasSynced = Socket.isMainStreamReadyMd;
                    listeners.push([
                        Socket,
                        'set_socket_state',
                        (state) => {
                            window.onAuthAppStateChangedEvent(state);
                        },
                    ]);
                    listeners.push([
                        Socket,
                        'open_socket_stream',
                        () => {
                            window.onAppStateHasSyncedEvent();
                        },
                    ]);
                } else {
                    Socket = window.require('WAWebSocketModel').Socket;
                    listeners.push([
                        Socket,
                        'change:state',
                        (_AppState, state) => {
                            window.onAuthAppStateChangedEvent(state);
                        },
                    ]);
                    listeners.push([
                        Socket,
                        'change:hasSynced',
                        () => {
                            window.onAppStateHasSyncedEvent();
                        },
                    ]);
                }`;

const goodInjectRoute = `                const backendEventBus = window.require?.('WAWebBackendEventBus')?.BackendEventBus;
                const wsModel = window.require?.('WAWebSocketModel')?.Socket;
                let Socket = backendEventBus || wsModel;

                if (backendEventBus) {
                    Socket.hasSynced = Socket.isMainStreamReadyMd ?? Socket.hasSynced ?? true;
                    listeners.push([
                        Socket,
                        'set_socket_state',
                        (state) => {
                            window.onAuthAppStateChangedEvent(state);
                        },
                    ]);
                    listeners.push([
                        Socket,
                        'open_socket_stream',
                        () => {
                            window.onAppStateHasSyncedEvent();
                        },
                    ]);
                } else if (wsModel) {
                    listeners.push([
                        Socket,
                        'change:state',
                        (_AppState, state) => {
                            window.onAuthAppStateChangedEvent(state);
                        },
                    ]);
                    listeners.push([
                        Socket,
                        'change:hasSynced',
                        () => {
                            window.onAppStateHasSyncedEvent();
                        },
                    ]);
                }`;

if (content.includes(badInjectRouteTarget)) {
  content = content.replace(badInjectRouteTarget, goodInjectRoute);
  modified = true;
  console.log('patch-wwebjs: Applied fix for inject route listeners');
}

// 2. Patch Socket.hasSynced check
const badSyncTarget = `                const storeInjected = typeof window.WWebJS !== 'undefined';
                if (Socket.hasSynced === true && !storeInjected) {
                    window.onAppStateHasSyncedEvent();
                }`;

const goodSync = `                const storeInjected = typeof window.WWebJS !== 'undefined';
                const isSynced = Socket?.hasSynced === true || Socket?.isMainStreamReadyMd === true;
                if (isSynced && !storeInjected) {
                    window.onAppStateHasSyncedEvent();
                }`;

if (content.includes(badSyncTarget)) {
  content = content.replace(badSyncTarget, goodSync);
  modified = true;
  console.log('patch-wwebjs: Applied fix for Socket.hasSynced check');
}

// 3. Patch line 919 takeover
const badTakeover = `window
                                    .require('WAWebSocketModel')
                                    .Socket.takeover()`;
const goodTakeover = `(window.require?.('WAWebSocketModel')?.Socket?.takeover?.() || window.require?.('WAWebBackendEventBus')?.BackendEventBus?.triggerReconnectSocket?.())`;

if (content.includes(badTakeover)) {
  content = content.replace(badTakeover, goodTakeover);
  modified = true;
  console.log('patch-wwebjs: Applied fix for takeover()');
}

// 4. Patch line 1106 attachEventListeners AppState
const badAppState = `            const { Msg, Chat } = window.require('WAWebCollections');
            const AppState = window.require('WAWebSocketModel').Socket;`;

const goodAppState = `            const { Msg, Chat } = window.require('WAWebCollections');
            const AppState = window.require?.('WAWebSocketModel')?.Socket || window.require?.('WAWebBackendEventBus')?.BackendEventBus;`;

if (content.includes(badAppState)) {
  content = content.replace(badAppState, goodAppState);
  modified = true;
  console.log('patch-wwebjs: Applied fix for attachEventListeners AppState');
}

// 5. Patch line 1145 AppState.on
const badAppStateOn = `            AppState.on('change:state', (_AppState, state) => {
                window.onAppStateChangedEvent(state);
            });`;

const goodAppStateOn = `            if (AppState?.on) {
                AppState.on('change:state', (_AppState, state) => {
                    window.onAppStateChangedEvent(state);
                });
                AppState.on('set_socket_state', (state) => {
                    window.onAppStateChangedEvent(state);
                });
            }`;

if (content.includes(badAppStateOn)) {
  content = content.replace(badAppStateOn, goodAppStateOn);
  modified = true;
  console.log('patch-wwebjs: Applied fix for AppState.on listener');
}

// 6. Patch waitForFunction('window.Debug?.VERSION != undefined') to prevent auth timeout on cloud containers
const badWaitForVersion = `waitForFunction('window.Debug?.VERSION != undefined'`;
const goodWaitForVersion = `waitForFunction('window.Debug?.VERSION != undefined || window.require != undefined || document.querySelector("canvas") != null'`;
if (content.includes(badWaitForVersion)) {
  content = content.replace(badWaitForVersion, goodWaitForVersion);
  modified = true;
  console.log('patch-wwebjs: Applied fix for waitForFunction window.Debug');
}

// 7. Patch getWWebVersion to safely fallback if Debug is undefined
const badGetVersion = `return window.Debug.VERSION;`;
const goodGetVersion = `return window.Debug?.VERSION || '2.3000.x';`;
if (content.includes(badGetVersion)) {
  content = content.replace(badGetVersion, goodGetVersion);
  modified = true;
  console.log('patch-wwebjs: Applied fix for getWWebVersion');
}

if (modified) {
  fs.writeFileSync(clientJsPath, content, 'utf8');
  console.log('patch-wwebjs: whatsapp-web.js successfully patched!');
} else {
  console.log('patch-wwebjs: No patches needed or already patched.');
}

// 8. Patch LocalAuth.js logout so Windows EBUSY file locks do not crash the server
const localAuthJsPath = path.join(__dirname, 'node_modules/whatsapp-web.js/src/authStrategies/LocalAuth.js');
if (fs.existsSync(localAuthJsPath)) {
  let localAuthContent = fs.readFileSync(localAuthJsPath, 'utf8');
  const badLocalAuthLogout = `                .catch((e) => {
                    throw new Error(e);
                });`;
  const safeLocalAuthLogout = `                .catch((e) => {
                    console.warn('[patch-wwebjs] LocalAuth logout: userDataDir locked or busy (ignored safely):', e.message);
                });`;
  if (localAuthContent.includes(badLocalAuthLogout)) {
    localAuthContent = localAuthContent.replace(badLocalAuthLogout, safeLocalAuthLogout);
    fs.writeFileSync(localAuthJsPath, localAuthContent, 'utf8');
    console.log('patch-wwebjs: Applied safe fix for LocalAuth.js EBUSY crash');
  }
}

