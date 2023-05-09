const WebSocket = require('ws');
const wss = new WebSocket.Server({'port': 80});
const KEY = Buffer.from('REVyV2Y0M0hKZk5CMjFSa05JY05IWjBkRFIzVEhZN0c5SGY1MzRGZEV3TldtaDNRVUd4d1RSS2k4NDZ5SFRnZQ==', 'base64').toString();

wss.on('connection', (ws, req) => {
  const {url} = req;
  const id = Number(url.split('/').pop().split('?').shift());
  const apiKey = url.split('apiKey=').pop().split('&').shift();
  //
  if (!apiKey || apiKey !== KEY) {
    ws.send(JSON.stringify({
      'error': apiKey ? 'wrong API key' : 'apiKey is mandatory parameter'
    }));
    //
    return ws.close();
  }
  //
  if (isNaN(id)) {
    ws.send(JSON.stringify({
      'error': 'unknown id'
    }));
    //
    return ws.close();
  }
  //
  if (id < 1 || id > 1000) {
    ws.send(JSON.stringify({
      'error': 'out of range'
    }));
    //
    return ws.close();
  }
  //
  ws.id = id;
  ws.apiKey = apiKey;
  //
  ws.on('message', msg => {
    for (const client of wss.clients) {
      const cond_1 = client !== ws;
      const cond_2 = client.id === id;
      const cond_3 = client.apiKey === apiKey;
      const cond_4 = client.readyState === WebSocket.OPEN;
      //
      if (cond_1 && cond_2 && cond_3 && cond_4) {
        client.send(msg + '');
      }
    }
  });
});