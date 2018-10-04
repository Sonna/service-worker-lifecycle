# Service Worker Lifecycle

_[The requested document from the Trello card of same name](https://trello.com/c/q18oSI4b/3941-5-sw-implement-and-document-service-worker-lifecycle)_

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

However, despite running in the client's browser the Service Worker will **not** have access to the DOM, the `window`, synchronous [`XHR`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) or [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), since they are fully async <sup>[1](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API#Service_worker_concepts_and_usage)</sup>.

Also, Service workers only run over HTTPS and be served from the same domain, since they
> act as proxy servers that sit between web applications, the browser, and the network (when available)
>
like _"man-in-the-middle" attack_.

## Install Service Worker

### Add routes for installing

~~ > Avoid changing the URL of your service worker script ~~
~~ > - https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#avoid_changing_the_url_of_your_service_worker_script ~~

~~Generally the install and served Service Worker script are one in the same.~~

~~However, in terms of domain scope, different scopes mean registering different Service Workers.~~

^ _Apologies, and please ignore the earlier ignorant comments_

Something like the following would allow for a Service Worker to be registered at a different that the page it was loaded from. However, still needs to be the same domain.

> ```js
>     if ('serviceWorker' in navigator) {
>       // Register a service worker hosted at the root of the
>       // site using the default scope.
>       navigator.serviceWorker.register('/sw.js').then(function(registration) {
>         console.log('Service worker registration succeeded:', registration);
>       }, /*catch*/ function(error) {
>         console.log('Service worker registration failed:', error);
>       });
>     } else {
>       console.log('Service workers are not supported.');
>     }
> ```
> [...] If I needed to register a service worker on example.com/product/description.html that applied to all of example.com, I would leave off the scope as above.
> - https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register


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
> ```js
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
> ```
>
> - https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#handling_updates



## Emergency update/disable Service Worker
## Removal / Disable Service Worker

> Programatically Removing a Service Worker
> ```js
>   navigator.serviceWorker.getRegistrations().then(
>     function(registrations) {
>         for(let registration of registrations) {
>             registration.unregister();
>         }
> });
> ```
> - https://love2dev.com/blog/how-to-uninstall-a-service-worker/
> - https://stackoverflow.com/questions/33704791/how-do-i-uninstall-a-service-worker

This would unregister a Service Worker, however would leave the caches as-is, this removes a bit more code

Based off the suggestions in [StackOverflow - How do I clear service worker caches when unregistering?](https://stackoverflow.com/questions/47358643/how-do-i-clear-service-worker-caches-when-unregistering); e.g. something like the following

```js
self.addEventListener('message', (event) => {
    messageHandler(event);
});

const PURGE_CACHE_ACTION = 'purge_cache';
const CACHE_NAME = 'mycache';

function messageHandler(event) {
    if (event.data === PURGE_CACHE_ACTION) {
        caches.delete(CACHE_NAME)
        .then((success) => {
            console.log("Cache removal status: " + success);
        })
        .catch((err) => {
            console.log("Cache removal error: ", err);
        });
    }
}
```

Then during the unregistering of Service Workers, call this purge event before unregistering; e.g.

```js
navigator.serviceWorker.getRegistration()
.then((registration) => {
    registration.active.postMessage(PURGE_CACHE_ACTION); // :point_left:
    // :point_down: Before this
    registration.unregister()
    .then((success) => { console.log('Service worker unregistration status: ' + success); })
    .catch((err) => { console.log('Service worker unregistration failed', err); });
})
.catch((err) => { console.log('Service worker registration not found.'); });
```

[See also this discussion on StackOverflow, about **why** wanting to unregister a Service Worker, when updating an existing Service Worker to one that does nothing might be easier](https://stackoverflow.com/questions/46424367/how-to-unregister-and-remove-old-service-worker)

Also, all Service Worker code should probably be wrapped in the following condition to ensure that only supported Browsers execute Service Worker code:

```js
if(window.navigator && navigator.serviceWorker) { }
```

## BONUS!

### Unit testing a Service Worker

- https://hackernoon.com/service-worker-testing-made-easy-9a2d8e9aa50
- https://www.npmjs.com/package/service-worker-mock
- https://medium.com/dev-channel/testing-service-workers-318d7b016b19
- https://stackoverflow.com/questions/44222121/setting-up-jsdom-navigator-serviceworker-for-unit-testing-service-workers

## See also

- [GOING OFFLINE by Jeremy Keith](https://abookapart.com/products/going-offline)
- [MDN - Service Worker API][MDN - Service Worker API]
- [Google Developers Web Fundamentals - The Service Worker Lifecycle](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle)
- [Mozilla's Service Workers Cookbook](https://serviceworke.rs/)

[MDN - Service Worker API]: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
