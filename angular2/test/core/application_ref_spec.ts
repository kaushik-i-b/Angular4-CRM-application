import {
  ddescribe,
  describe,
  it,
  iit,
  xit,
  expect,
  beforeEach,
  afterEach,
  el,
  AsyncTestCompleter,
  fakeAsync,
  tick,
  inject,
  SpyObject
} from 'angular2/testing_internal';
import {SpyChangeDetector} from './spies';
import {ApplicationRef_, ApplicationRef, PlatformRef_} from "angular2/src/core/application_ref";
import {Injector, Provider, APP_INITIALIZER} from "angular2/core";
import {ChangeDetectorRef_} from "angular2/src/core/change_detection/change_detector_ref";
import {PromiseWrapper, PromiseCompleter, TimerWrapper} from "angular2/src/facade/async";
import {ListWrapper} from "angular2/src/facade/collection";

export function main() {
  describe("ApplicationRef", () => {
    it("should throw when reentering tick", () => {
      var cd = <any>new SpyChangeDetector();
      var ref = new ApplicationRef_(null, null, null);
      ref.registerChangeDetector(new ChangeDetectorRef_(cd));
      cd.spy("detectChanges").andCallFake(() => ref.tick());
      expect(() => ref.tick()).toThrowError("ApplicationRef.tick is called recursively");
    });
  });

  describe("PlatformRef", () => {
    describe("asyncApplication", () => {
      function expectProviders(injector: Injector, providers: Array<any>): void {
        for (let i = 0; i < providers.length; i++) {
          let provider = providers[i];
          expect(injector.get(provider.token)).toBe(provider.useValue);
        }
      }

      it("should merge syncronous and asyncronous providers",
         inject([AsyncTestCompleter, Injector], (async, injector) => {
           let ref = new PlatformRef_(injector, null);
           let ASYNC_PROVIDERS = [new Provider(Foo, {useValue: new Foo()})];
           let SYNC_PROVIDERS = [new Provider(Bar, {useValue: new Bar()})];
           ref.asyncApplication((zone) => PromiseWrapper.resolve(ASYNC_PROVIDERS), SYNC_PROVIDERS)
               .then((appRef) => {
                 var providers = ListWrapper.concat(ASYNC_PROVIDERS, SYNC_PROVIDERS);
                 expectProviders(appRef.injector, providers);
                 async.done();
               });
         }));

      it("should allow function to be null",
         inject([AsyncTestCompleter, Injector], (async, injector) => {
           let ref = new PlatformRef_(injector, null);
           let SYNC_PROVIDERS = [new Provider(Bar, {useValue: new Bar()})];
           ref.asyncApplication(null, SYNC_PROVIDERS)
               .then((appRef) => {
                 expectProviders(appRef.injector, SYNC_PROVIDERS);
                 async.done();
               });
         }));

      function mockAsyncAppInitializer(completer, providers: Array<any> = null,
                                       injector?: Injector) {
        return () => {
          if (providers != null) {
            expectProviders(injector, providers);
          }
          TimerWrapper.setTimeout(() => completer.resolve(true), 1);
          return completer.promise;
        };
      }

      function createSpyPromiseCompleter(): SpyObject {
        let completer = PromiseWrapper.completer();
        let completerSpy = <any>new SpyObject();
        // Note that in TypeScript we need to provide a value for the promise attribute
        // whereas in dart we need to override the promise getter
        completerSpy.promise = completer.promise;
        completerSpy.spy("get:promise").andReturn(completer.promise);
        completerSpy.spy("resolve").andCallFake(completer.resolve);
        completerSpy.spy("reject").andCallFake(completer.reject);
        return completerSpy;
      }

      it("should wait for asyncronous app initializers",
         inject([AsyncTestCompleter, Injector], (async, injector) => {
           let ref = new PlatformRef_(injector, null);

           let completer = createSpyPromiseCompleter();
           let SYNC_PROVIDERS = [
             new Provider(Bar, {useValue: new Bar()}),
             new Provider(APP_INITIALIZER,
                          {useValue: mockAsyncAppInitializer(completer), multi: true})
           ];
           ref.asyncApplication(null, SYNC_PROVIDERS)
               .then((appRef) => {
                 expectProviders(appRef.injector,
                                 SYNC_PROVIDERS.slice(0, SYNC_PROVIDERS.length - 1));
                 expect(completer.spy("resolve")).toHaveBeenCalled();
                 async.done();
               });
         }));

      it("should wait for async providers and then async app initializers",
         inject([AsyncTestCompleter, Injector], (async, injector) => {
           let ref = new PlatformRef_(injector, null);
           let ASYNC_PROVIDERS = [new Provider(Foo, {useValue: new Foo()})];
           let completer = createSpyPromiseCompleter();
           let SYNC_PROVIDERS = [
             new Provider(Bar, {useValue: new Bar()}),
             new Provider(APP_INITIALIZER,
                          {
                            useFactory: (injector) => mockAsyncAppInitializer(
                                            completer, ASYNC_PROVIDERS, injector),
                            multi: true,
                            deps: [Injector]
                          })
           ];
           ref.asyncApplication((zone) => PromiseWrapper.resolve(ASYNC_PROVIDERS), SYNC_PROVIDERS)
               .then((appRef) => {
                 expectProviders(appRef.injector,
                                 SYNC_PROVIDERS.slice(0, SYNC_PROVIDERS.length - 1));
                 expect(completer.spy("resolve")).toHaveBeenCalled();
                 async.done();
               });
         }));
    });

    describe("application", () => {
      it("should throw if an APP_INITIIALIZER returns a promise", inject([Injector], (injector) => {
           let ref = new PlatformRef_(injector, null);
           let appInitializer = new Provider(
               APP_INITIALIZER, {useValue: () => PromiseWrapper.resolve([]), multi: true});
           expect(() => ref.application([appInitializer]))
               .toThrowError(
                   "Cannot use asyncronous app initializers with application. Use asyncApplication instead.");
         }));
    });
  });
}

class Foo {
  constructor() {}
}

class Bar {
  constructor() {}
}
