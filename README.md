# [Service Worker Lifecycle](https://trello.com/c/q18oSI4b/3941-5-sw-implement-and-document-service-worker-lifecycle)

[TOC]

A quick rundown on what a Service Worker is:
- A script that runs in the background
- Separate from the web page
- Allows for features like:
    - [Push Notifications](https://developers.google.com/web/updates/2015/03/push-notifications-on-the-open-web); opt-in notifications from websites on the desktop
        - [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API);
          Displays interactive notifications via the operating system's native notification system
        - [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API);  receive messages from the server, even when the app is not in the foreground or currently loaded
    - [Background Sync](https://developers.google.com/web/updates/2015/12/background-sync); defers & re-attempts online requests when intermittently offline
    - [Channel Messaging API](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API); communication between web workers, service workers & host application

However, despite running in the client's browser the Service Worker will **not** have access to the DOM, the `window`, synchronous [`XHR`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) or [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), since they are fully async.<sup>[\[1\]](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API#Service_worker_concepts_and_usage "Service worker concepts and usage")</sup>

Also, Service workers only run over HTTPS and be served from the same domain, since they
> act as proxy servers that sit between web applications, the browser, and the network (when available)
>
like _"man-in-the-middle" attack_.

## Install Service Worker

> The simplest way to [install a Service Worker] is with a link element in the head of your site’s HTML:
>
> ```html
>   <link rel="serviceworker" href="/serviceworker.js">
> ```
> -- [pg12 ch2 "REGISTRATION" - GOING OFFLINE][GOING OFFLINE by Jeremy Keith]

### Registration

Unfortunately not all browsers support this and thus its safer to include JavaScript in an external file or the bottom of the page:

```htmlmixed
   <script>
       if (navigator.serviceWorker) { // <- feature detection
           navigator.serviceWorker.register('/serviceworker.js');
       }
   </script>
```

Its also strongly recommended to check if the browser does support Service Workers `if (navigator.serviceWorker) {}` (or `if (window.navigator && navigator.serviceWorker) {}`) before attemptting to register one.

_Alternatively, `('serviceWorker' in navigator)` or `(navigator.serviceWorker !== undefined)` conditional expression can be used instead to check for Service Worker Browser support._

**See also:**
- [MDN Service Worker `register`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)

### Scope

> By default, the scope is derived from where you put your service worker script. If your service worker script resides at `/js/serviceworker.js`, the script will only be able to control URLs that start with `/js`.
> -- [pg15 ch2 "REGISTRATION" - GOING OFFLINE][GOING OFFLINE by Jeremy Keith]

Multiple Service Workers can be ran on the same domain, but only one Service Worker will be active for a given scope. The active and in control Service Worker will be the one with the more specific the scope it is registered from; e.g.

```htmlmixed
<script>
   // `serviceworker1.js` & `serviceworker2.js` never both active in same scope
   // - `serviceworker1.js` active on pages under `/myapp`
   // - `serviceworker2.js` active on pages under `/myotherapp`
   navigator.serviceWorker.register('/myapp/serviceworker1.js');
   navigator.serviceWorker.register('/myotherapp/serviceworker2.js');

   // - `serviceworker1.js` active on pages under `/` (i.e. the entire site)
   // - `serviceworker2.js` active on pages under `/myapp`, whilst `serviceworker1.js` is no longer active or ran on those pages
   navigator.serviceWorker.register('/serviceworker1.js');
   navigator.serviceWorker.register('/myapp/serviceworker2.js');
</script>
```

[`scope` can also be passed in as an option when registering a Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameters); e.g.

```htmlmixed
<script>
   // - `serviceworker1.js` active on pages under `/` (i.e. the entire site)
   // - `serviceworker2.js` active on pages under `/myapp`, whilst `serviceworker1.js` is no longer active or ran on those pages
    navigator.serviceWorker.register('/serviceworker1.js');
    navigator.serviceWorker.register('/serviceworker2.js', { scope: '/myapp/' });
</script>
```

Or in support browsers:

```htmlmixed
    <link rel="serviceworker" href="/serviceworker1.js">
    <link rel="serviceworker" href="/serviceworker2.js" scope="/myapp/">
```

Also "avoid changing the URL of your service worker script" <sup>[\[2\]](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#avoid_changing_the_url_of_your_service_worker_script "Avoid changing the url of your service worker script")</sup>, since a previously registered Service Worker at the same scope when trump any newer Serivce Worker that gets registered and potentially cause old cached information to be served on the website.

### `Promise`

Since the Service Worker environment is asynchronous Promises are available and can be used, with `register` call returning a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise); e.g. an example of logging to console a Service Worker registering successfully or unsuccessfully

```htmlmixed
    <script>
        if (navigator.serviceWorker) {
            navigator.serviceWorker.register('/serviceworker.js')
                .then(function (registration) {
                    console.log('Success!', registration.scope);
                    // TODO: Analytics log registered Service Worker for client
                })
                .catch(function (error) {
                    console.error('Failure!', error);
                    // TODO: Bugsnag log failure to register
                });
        }
    </script>
```

_Notes: Later on this document will describe to hook into Service Worker events; like `install`, where caching requests are usually added; but the above is a good place take for future implementing initial bug tracking (outside the usual `error` events post-install)._

### 1. Download 2. Install 3. Wait 4. Activate

On the first visit to page that includes a Service Worker, it will be downloaded, get installed **once**, then will not receive events; like `fetch` & `push`; until finished installing & becomes "active", which by default, will not be until the page has been refreshed and the page requests can intercepted through the Service Worker.<sup>[\[3\]](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#the_first_service_worker "The first Service Worker")</sup>

<!-- ![Simplified version of Service Worker lifecycle, on first install](https://developers.google.com/web/fundamentals/primers/service-workers/images/sw-lifecycle.png) -->

This "waiting" before "active" on initial install can be skipped; by calling `self.skipWaiting()` during the install event; however comes with some implicit cautionary warnings:

> Caution: `skipWaiting()` means that your new service worker is likely controlling pages that were loaded with an older version. This means some of your page's fetches will have been handled by your old service worker, but your new service worker will be handling subsequent fetches. If this might break things, don't use `skipWaiting()`.<sup>[\[4\]](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#skip_the_waiting_phase "Skip the waiting phasee")</sup>

Otherwise, feel free to add the `skipWaiting()` call in the install event, usually before the caching; e.g.

```javascript
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    // caching etc
  );
});
```

See also:
- [Download, install and activate - Service Worker API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API#Download_install_and_activate)

### Post Install script -> Begin caching

After registering a Service Worker, work can be handle in its various lifecycle events. The most common work to be done is during the `install` event is to cache files<sup>[\[5\]](https://developers.google.com/web/fundamentals/primers/service-workers/#install_a_service_worker "Install a Service Worker")</sup>; e.g.

```javascript
var CACHE_NAME = 'my-site-cache-v1';
var urlsToCache = [
  '/',
  '/styles/main.css',
  '/script/main.js'
];

self.addEventListener('install', event => {
    // Perform install steps
    const preLoaded = caches.open(CACHE_NAME) // 1. Open a cache
        .then(cache => cache.addAll(urlsToCache)) // 2. Cache our files
        .catch(error => { /* TODO: log `error` */ });
    event.waitUntil(preLoaded); // 3. Confirm whether all the required assets are cached or not
})
```

Currently available events a Service Worker can listen to:
- [`statechange`](https://developer.mozilla.org/en-US/docs/Web/Events/statechange)
  > A `statechange` event occurs when the [`RTCIceTransport`](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceTransport) changes state.
- [`updatefound`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/onupdatefound)
  > is fired any time the [`ServiceWorkerRegistration.installing`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration.installing) property acquires a new service worker
- [`controllerchange`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/oncontrollerchange)
  > when the document's associated [`ServiceWorkerRegistration`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration) acquires a new [`ServiceWorkerRegistration.active`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/active) worker.
- [`error`](https://developer.mozilla.org/en-US/docs/Web/Events/error)
  > The `error` event is fired when an error occurred
- [`message`](https://developer.mozilla.org/en-US/docs/Web/Events/activate)
  > A `message` event informs the target, ... , that a message has been received
- [`install`](https://developer.mozilla.org/en-US/docs/Web/Events/install)
  > is fired when the browser has successfully installed a page as an application
- [`activate`](https://developer.mozilla.org/en-US/docs/Web/Events/activate)
  > Occurs when [a Service Worker] is activate
- [`fetch`](https://developer.mozilla.org/en-US/docs/Web/Events/fetch)
  > [event type for fetch events](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent) dispatched on the [service worker global scope](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope).

- [`sync`](https://developers.google.com/web/updates/2015/12/background-sync)
  Background data synchronization, when no tab to the website is open, but Service Worker has woken up (Ideal for: Non-urgent updates; good for timelines/news, but bad for messaging)<sup>[\[6\]](https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/#on-background-sync "On Background Sync")</sup>

### Cache and return requests

In order to make the website available offline, it needs to be intercept network requests and store them in the cache, so that they can be viewed later. There are several approaches to this:

- cache only
- network only
- cache falling back to network
- network falling back to cache
- cache then network
- _offline page_

This document will list the last, since the first two; "cache only" & "network only"; are unlikely to be used.

**See also:**
- [Jake Archibald's Offline Cookbook](https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/)
- [Caching Files with Service Worker](https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker)

#### Cache falling back to network

```typescript
// Cache and return requests, otherwise fallback to fetching new requests
self.addEventListener('fetch', (event: FetchEvent) => {
    const response = caches.match(event.request)
        .then(match => match || fetch(event.request));
    event.respondWith(response);
});
```
-- [Cache falling back to the network](https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker#cache_falling_back_to_the_network)

#### Network falling back to Cache

```typescript
self.addEventListener('fetch', (event: FetchEvent) => {
    const response = fetch(event.request)
        .catch(() => caches.match(event.request));
    event.respondWith(response);
});
```
-- [Cache falling back to the network](https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker#cache_falling_back_to_the_network)

#### Cache then Network

This approach is recommended for resources that update frequently, it first load from the cache and then later replace it with up-to-date content when the fetch request has finished.

**Client code**:

```htmlmixed
<script>
    // function updatePage() {} // exists somewhere else
    var networkDataReceived = false;

    startSpinner();

    // fetch fresh data
    var networkUpdate = fetch('/data.json').then(function(response) {
      return response.json();
    }).then(function(data) {
      networkDataReceived = true;
      updatePage(data);
    });

    // fetch cached data
    caches.match('/data.json').then(function(response) {
      if (!response) throw Error("No data");
      return response.json();
    }).then(function(data) {
      // don't overwrite newer network data
      if (!networkDataReceived) {
        updatePage(data);
      }
    }).catch(function() {
      // we didn't get cached data, the network is our last hope:
      return networkUpdate;
    }).catch(showErrorMessage).then(stopSpinner());
</script>
```

This sends a request to website and pulls from cache at the same, with the cache to be likely victor, should the fetch request not return in time. This works by checking if `networkDataReceived` state has been changed before the cache updates the page, but network update will change the page regardless and update the `networkDataReceived` state to inform the cache to not to as well.

**Service Worker:**

```javascript
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.open('mysite-dynamic')
            .then(cache => fetch(event.request)
                .then(response => {
                    cache.put(event.request, response.clone());
                    return response;
                  })
            })
    );
});
```

This Service Worker is similar to the "Cache falling back to network" code, but clones the `response` so that it does not consume before the Browser can use it as well; effectively creating two response streams, one for the Browser and another for Cache, since a stream can only be consumed once. <sup>[\[7\]](https://developers.google.com/web/fundamentals/primers/service-workers/#cache_and_return_requests "Cache and return Requests")</sup>

### Caching outside the Service Worker

Interestingly because the Cache can be accessed outside the Service Worker within the regular frontend client JavaScript and since the cache had some simple methods to add to the cache; i.e. `cache.add(request)`, `cache.addAll(requests)` & `cache.put(request, response)` <sup>[\[8\]](https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker#working_with_data "Working with data")</sup>; requests can added to the cache on User interaction; e.g, "Read Later" or "Save for offline" button.

```htmlmixed
<script>
    document.querySelector('.cache-article').addEventListener('click', function(event) {
        event.preventDefault();
        var id = this.dataset.articleId;

        caches.open('mysite-article-' + id).then(function(cache) {
            fetch('/get-article-urls?id=' + id).then(function(response) {
                // /get-article-urls returns a JSON-encoded array of
                // resource URLs that a given article depends on
                return response.json();
            }).then(function(urls) {
                cache.addAll(urls);
            });
        });
    });
</script>
```
> In the above example, when the user clicks an element with the `cache-article` class, we are getting the article ID, fetching the article with that ID, and adding the article to the cache.
> -- [On user interaction](https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker#on_user_interaction)

## Update Service Worker

> In brief:
>
> - An update is triggered:
>   * On navigation to an in-scope page.
>   * On functional events such as `push` and `sync`, unless there's been an update check within the previous 24 hours.
>   * On calling `.register()` only if the service worker URL has changed.
> - Most browsers, including [Chrome 68 and later](https://developers.google.com/web/updates/2018/06/fresher-sw), default to ignoring caching headers when checking for updates of the registered service worker script. They still respect caching headers when fetching resources loaded inside a service worker via `importScripts()`. You can override this default behavior by setting the [`updateViaCache`](https://developers.google.com/web/updates/2018/06/fresher-sw#updateviacache) option when registering your service worker.
> - Your service worker is considered updated if it's byte-different to the one the browser already has. (We're extending this to include imported scripts/modules too.)
> - The updated service worker is launched alongside the existing one, and gets its own `install` event.
> - If your new worker has a non-ok status code (for example, 404), fails to parse, throws an error during execution, or rejects during install, the new worker is thrown away, but the current one remains active.
> - Once successfully installed, the updated worker will `wait` until the existing worker is controlling zero clients. (Note that clients overlap during a refresh.)
> - `self.skipWaiting()` prevents the waiting, meaning the service worker activates as soon as it's finished installing.
>
> -- https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#updates

Also,

> The service worker was designed as part of the extensible web. The idea is that we, as browser developers, acknowledge that we are not better at web development than web developers. And as such, we shouldn't provide narrow high-level APIs that solve a particular problem using patterns we like, and instead give you access to the guts of the browser and let you do it how you want, in a way that works best for your users.
>
> So, to enable as many patterns as we can, the whole update cycle is observable:
>
> ```htmlmixed
> <script>
>   navigator.serviceWorker.register('/sw.js').then(reg => {
>     reg.installing; // the installing worker, or undefined
>     reg.waiting; // the waiting worker, or undefined
>     reg.active; // the active worker, or undefined
>
>     reg.addEventListener('updatefound', () => {
>       // A wild service worker has appeared in reg.installing!
>       const newWorker = reg.installing;
>
>       newWorker.state;
>       // "installing" - the install event has fired, but not yet complete
>       // "installed"  - install complete
>       // "activating" - the activate event has fired, but not yet complete
>       // "activated"  - fully active
>       // "redundant"  - discarded. Either failed install, or it's been
>       //                replaced by a newer version
>
>       newWorker.addEventListener('statechange', () => {
>         // newWorker.state has changed
>       });
>     });
>   });
>
>   navigator.serviceWorker.addEventListener('controllerchange', () => {
>     // This fires when the service worker controlling this page
>     // changes, eg a new worker has skipped waiting and become
>     // the new active worker.
>   });
> </script>
> ```
>
> - https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#handling_updates

### Manual updates

[As previously mentioned](#Update-Service-Worker), the browser will check for updates automatically, _after navigations and functional events_, but these updates can also be triggered manually:

```htmlmixed
<script>
    navigator.serviceWorker.register('/sw.js').then(reg => {
        // sometime later...
        reg.update();
    });
</script>
```

These is useful when an user is expected to be using a site for a long time without reloading, as such calling `update()` on an interval (such as hourly) will help prevent the Service Worker and caches from going stale.<sup>[\[9\]](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#manual_updates "Manual Updates")</sup>

## Removal / Disable Service Worker

> Programatically Removing a Service Worker
> ```javascript
>   navigator.serviceWorker.getRegistrations()
>       .then(function(registrations) {
>           for(let registration of registrations) {
>               registration.unregister();
>           }
>       });
> ```
> - https://love2dev.com/blog/how-to-uninstall-a-service-worker/
> - https://stackoverflow.com/questions/33704791/how-do-i-uninstall-a-service-worker

The above code will unregister all Service Workers, however would leave their caches as-is, to remove this as well a bit more code is required as follows:

```javascript
self.addEventListener('message', (event) => {
    messageHandler(event);
});

const PURGE_CACHE_ACTION = 'purge_cache';
const CACHE_NAME = 'mycache';

function messageHandler(event) {
    if (event.data === PURGE_CACHE_ACTION) {
        caches.delete(CACHE_NAME)
            .then((success) => { console.log("Cache removal status: " + success); })
            .catch((err) => { console.log("Cache removal error: ", err); });
    }
}
```

Then during the unregistering of Service Workers, call this purge event before unregistering; e.g.

```htmlmixed
<script>
    navigator.serviceWorker.getRegistration()
        .then((registration) => {
            registration.active.postMessage(PURGE_CACHE_ACTION); // :point_left: Add this

            // :point_down: Before this
            registration.unregister()
                .then((success) => { console.log('Service worker unregistration status: ' + success); })
                .catch((err) => { console.log('Service worker unregistration failed', err); });
        })
        .catch((err) => { console.log('Service worker registration not found.'); });
</script>
```

_The above code is based off the suggestions made in [StackOverflow - How do I clear service worker caches when unregistering?](https://stackoverflow.com/questions/47358643/how-do-i-clear-service-worker-caches-when-unregistering)_

Alternatively, instead of sending a message to purge the cache, all older caches that do not match the current version could be removed: e.g.

```javascript
// Remember that caches are shared across the whole origin,
// so be careful which caches are removed
const CACHE_NAME = 'mycache';

self.addEventListener('activate', event => {
    const purgeCaches = caches.keys()
        .then(cacheNames => Promise.all(
            cacheNames
                .filter(cacheName => cacheName !== CACHE_NAME)
                .map(cacheName => caches.delete(cacheName))
      );
    );
    event.waitUntil(purgeCaches);
});
```
-- [Removing outdated caches](https://developers.google.com/web/ilt/pwa/caching-files-with-service-worker#removing_outdated_caches)

Or instead Whitelist Cache names not marked for deletion:

```javascript
self.addEventListener('activate', event => {
    const cacheWhitelist = ['pages-cache-v1', 'blog-posts-cache-v1'];

    const cleanCaches = caches.keys().then(cacheNames =>
        cacheNames.filter(cacheName => !cacheWhitelist.includes(cacheName))
    ).then(cachesToDelete =>
        Promise.all(cachesToDelete.map(cacheToDelete => caches.delete(cacheToDelete)))
    );
    event.waitUntil(cleanCaches);
});
```

**See also:**
- [This discussion on StackOverflow, about **why** wanting to unregister a Service Worker, when updating an existing Service Worker to one that does nothing might be easier](https://stackoverflow.com/questions/46424367/how-to-unregister-and-remove-old-service-worker)

## Emergency update/disable Service Worker

In an emergency a `push` event would be recommended (a background `sync` could be used instead, but would not be immediate and need to be registered ahead of time as well), otherwise an User will not receive the update until they revisit the website and the browser picks up on the byte-code difference between its registered Service Worker and new one loaded onto the server.

So, as long as a Service Worker has permission to listen for push events and a user defined event type & handler have defined; e.g. `'purge_cache'` or `'disable_service_worker'`, etc; is regularly calling `update()` or the browser has detected a change to its registered Service Worker, then it should be possible.

The updated Service Worker to remove everything could be something like the following:

```javascript
self.addEventListener('message', (event) => {
    messageHandler(event);
});

const PURGE_ALL_CACHES_ACTION = 'purge_all_caches';

function purgeAllCaches() {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
        ))
    );
}

function messageHandler(event) {
    if (event.data === PURGE_ALL_CACHES_ACTION) {
        purgeAllCaches();
    }
}

// If Push notifications available, then the following
self.addEventListener('push', event => {
    pushHandler(event);
});

function pushHandler(event) { // same as `messageHandler`
    if (event.data === PURGE_ALL_CACHES_ACTION) {
        purgeAllCaches();
    }
}
```

Add in the client script:

```htmlmixed
<script>
    const PURGE_ALL_CACHES_ACTION = 'purge_all_caches';

    navigator.serviceWorker.getRegistrations()
       .then(registrations => {
           registrations.forEach(registration => {
               registration.active.postMessage(PURGE_ALL_CACHES_ACTION);
               registration.unregister();
           })
       });
</script>
```

_With any solution the User will have to be online for it to purge caches; `sync` or `push`; and looking at the website to `unregister()` the Service Worker._

### Background Sync

Throughout this document there have mentions of Background Sync API, but not explained it. Ideally it is used to schedule sending data beyond the life of the page; e.g. Chat messages, emails, document updates, settings changes, photo uploads, etc; generally anything that should reach the server even if the user navigates away or closes the tab. <sup>[\[9\]](https://developers.google.com/web/updates/2015/12/background-sync#what_could_i_use_background_sync_for)</sup> It achieves this by providing an API that allows for actions to be deferred until a stable connection has been resumed, firing off a `sync` event.

In order to use this Background Sync with a Service Worker

```htmlmixed
<script>
    const MY_SYNC_NAME = 'myFirstSync';

    // Register your service worker:
    navigator.serviceWorker.register('/sw.js');

    // Then later, request a one-off sync:
    navigator.serviceWorker.ready.then(function(swRegistration) {
      return swRegistration.sync.register(MY_SYNC_NAME);
    });
</script>
```

> Then listen for the event in /sw.js:

```javascript
// const doSomeStuff = Promise.new(/* ... */);
const MY_SYNC_NAME = 'myFirstSync';

self.addEventListener('sync', event => {
  if (event.tag === MY_SYNC_NAME) {
    event.waitUntil(doSomeStuff());
  }
});
```

The `doSomeStuff()` should return a promise so it can succeed or fail and be rescheduled to retry should it fail, until it is successful. All syncs (including retires) will wait for connectivity and employ an exponential back-off.<sup>[\[10\]](https://developers.google.com/web/updates/2015/12/background-sync#how_to_request_a_background_sync)</sup>

> The tag name of the sync (`'myFirstSync'` in the above example) should be unique for a given sync. If you register for a sync using the same tag as a pending sync, it coalesces with the existing sync. That means you can register for an "clear-outbox" sync every time the user sends a message, but if they send 5 messages while offline, you'll only get one sync when they become online. If you want 5 separate sync events, just use unique tags!
> -- [How to request a background sync](https://developers.google.com/web/updates/2015/12/background-sync#how_to_request_a_background_sync)

## BONUS!

This following section looks how one would go about Unit and Integration testing, as well as Workbox a tool built on top of Service Workers.

### Playground project

An toy example project is available at the following repository

- https://github.com/Sonna/service-worker-lifecycle

It was initially based off one of the Lab examples present on Google developers website; i.e. [Lab: Caching Files with Service Worker](https://developers.google.com/web/ilt/pwa/lab-caching-files-with-service-worker).

### Unit testing a Service Worker

Install your preferred testing tool/package, this README will use [Jest][Jest].

```shell
$ npm i -D jest
```

Install [`service-worker-mock`](https://www.npmjs.com/package/service-worker-mock) it will be necessary in order to create a similar environment for our Service Worker script to run in within our tests.

```shell
$ npm i -D service-worker-mock
```

Then with those libraries install the following test can be written to begin evaulating our Service Worker.

```javascript
// ./service-worker.test.js
const makeServiceWorkerEnv = require('service-worker-mock');
const makeFetchMock = require('service-worker-mock/fetch');

describe('Service worker', () => {
  beforeEach(() => {
    Object.assign(
      global,
      makeServiceWorkerEnv(),
      makeFetchMock(),
      // If you're using sinon ur similar you'd probably use below instead of makeFetchMock
      // fetch: sinon.stub().returns(Promise.resolve())
    );
    jest.resetModules();
  });
  it('should add listeners', () => {
    require('./service-worker.js');
    expect(self.listeners['install']).toBeDefined();
    expect(self.listeners['activate']).toBeDefined();
    expect(self.listeners['fetch']).toBeDefined();
  });

  it('should delete old caches on activate', async () => {
    require('./myapp/serviceworker2.js');
    await self.trigger('install'); // installs our expected cache

    // Create old cache
    await self.caches.open('OLD_CACHE');
    expect(self.snapshot().caches.OLD_CACHE).toBeDefined();

    // Activate and verify old cache is removed
    await self.trigger('activate');
    expect(self.snapshot().caches.OLD_CACHE).toBeUndefined();
    // expect(self.snapshot().caches['precache-v1']).toBeDefined();
    expect(self.snapshot().caches['myapp-site-cache-v1']).toBeDefined();
  });
});
```

**See also:**
- https://hackernoon.com/service-worker-testing-made-easy-9a2d8e9aa50
- https://www.npmjs.com/package/service-worker-mock
- https://medium.com/dev-channel/testing-service-workers-318d7b016b19
- https://stackoverflow.com/questions/44222121/setting-up-jsdom-navigator-serviceworker-for-unit-testing-service-workers

### Integration testing a Service Worker

- TODO
- See [Cypress issue - Simulate offline mode #235](https://github.com/cypress-io/cypress/issues/235)

However, there are some kown issues with using Cypress when a Service Worker is active, since it intercepts `fetch` requests:

> #### `window.fetch` routing and stubbing
>
> [Issue #95](https://github.com/cypress-io/cypress/issues/95)
>
> Support for `fetch` has not been added but it’s possible to handle in the same way as we handle `XHRs`. This biggest challenge here is that you can use `fetch` in `Service Workers` outside of the global context. We’ll likely have to move routing to the server and handle it in the proxy layer but it should be possible.
>
> While we currently provide things like the stack trace and initiator line for XHR’s we will not be able to provide that for `fetch`.
>
> **Workaround**
>
> Sit tight, [comment on the issue](https://github.com/cypress-io/cypress/issues/95) so we know you care about this support, and be patient.
>
> - https://docs.cypress.io/guides/references/known-issues.html#window-fetch-routing-and-stubbing

A solution might be to clear the cache before running on certain pages; e.g.

```javascript
beforeAll(() => {
    // run this once before all code
    return window.caches.keys().then(cacheNames =>
        Promise.all(cacheNames.map(cacheName => window.caches.delete(cacheName)))
    );
})
```
-- https://github.com/cypress-io/cypress/issues/702

Or unregistering them

```javascript
beforeAll(() => {
    window.navigator.serviceWorker.getRegistrations()
        .then(registrations => {
            registrations.forEach(registration => {
                registration.unregister()
                    .then((success) => {
                        console.log('Service worker unregistration status:', success);
                    })
                    .catch((err) => {
                        console.log('Service worker unregistration failed', err);
                    });
            });
        })
        .catch((err) => {
            console.log('Service worker registration not found.');
        });
}
```

### Workbox

[Workbox](https://workboxjs.org/)
- TODO (write up about it?)

### `importScripts()`

`importScripts()` is totally a thing that forgot to mention anywhere, but is available in a Service Worker to include other external scripts, which is often seen when using the generated Service Worker script provided by Workbox; e.g.

```javascript
importScripts('https://storage.googleapis.com/workbox-cdn/releases/3.4.1/workbox-sw.js');
```

## Other Important Notes

> During activation, other events such as fetch are put into a queue, so a long activation could potentially block page loads. Keep your activation as lean as possible, only use it for things you _couldn't_ do while the old version was active.
> -- https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook/


## See also

- [GOING OFFLINE by Jeremy Keith][GOING OFFLINE by Jeremy Keith]
- [MDN - Service Worker API][MDN - Service Worker API]
- [Google Developers Web Fundamentals - The Service Worker Lifecycle](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle)
- [Mozilla's Service Workers Cookbook](https://serviceworke.rs/)

- [Progressive Web Apps with Webpack](https://michalzalecki.com/progressive-web-apps-with-webpack/)

**Future concerns**
- [How to combine PWA and isomorphic rendering (SSR)?](https://michaljanaszek.com/blog/combine-pwa-and-isomorphic-rendering)

![Example application provided with this Repository](screenshot_2018-10-05_at_3.31.16_pm.png)

[MDN - Service Worker API]: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
[GOING OFFLINE by Jeremy Keith]: https://abookapart.com/products/going-offline
[Jest]: https://jestjs.io/
