# Amagi
#### A lavalink search wrapper with ratelimit protection. Fully customizable
Take note this module only handles search, not playing music, thus it's customizable. 

![Amagi](https://i.imgur.com/4ZefZpU.png)
> Amagi © Azur Lane

## Features
Hmm not much tbh   
✓ Easy to use  
✓ Pretty stable  
✓ Author is responsible with bugs*   
✓ Cache support**   
✓ Customizable***   
✓ Auto-disable rate limited node and use another    
✓ Anime character 💖💖💖💖

## Documentation
> [Pls read me](https://takiyo0.github.io/Amagi)

## Installation
> npm i amagi

## Plugins
You can use mostly any plugins with `load`, `unload`, and with some `bind`s inside it. Tested with erela.js's and kazagumo's plugin. **Because this module's plugin is universal, of course the result will not be the same as Amagi's `Promise<SearchResult>`. Handle it your own.** _Better to make/modify your own plugin so the response matches Amagi's._

## Why this module
I want to make a different manager for lavalink search so my main lavalink player is not disturbed. Best for massive search, you can add unlimited nodes except your node to prevent 429!

## Example
```js
const { Amagi } = require('../');

const NODES = [{
    host: 'you.weeb:443',
    auth: 'weebMaster',
    secure: true,
    identifier: 'NODE-WEEB-01'
}, {
    host: 'me.weeb:8080',
    auth: 'weebSenpai',
    identifier: 'NODE-WEEB-02'
}]

const amagi = new Amagi(NODES, {
    cache: {
        enabled: true,
        type: 'memory'
    },
    modifyTracks: (track) => ({ track: track.track, title: track.info.title })
});

// Scientific purpose
amagi.on('debug', console.log);
amagi.on('request', console.log);

// Init the module first
amagi.init().then(run);

function run() {
    amagi.search('wonder caravan', { engine: 'youtubeMusic' }).then(r => console.log(r)).catch(e => console.log(e));
}
```

## Notes
*= Depend on the author's availability   
**= Only works for non-plugin result    
***= Track is customizable, plugins can customize the module