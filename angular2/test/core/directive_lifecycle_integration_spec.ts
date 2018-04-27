import {
  AsyncTestCompleter,
  beforeEach,
  ddescribe,
  describe,
  expect,
  iit,
  inject,
  it,
  xdescribe,
  xit,
  Log,
  TestComponentBuilder
} from 'angular2/testing_internal';

import {
  OnChanges,
  OnInit,
  DoCheck,
  AfterContentInit,
  AfterContentChecked,
  AfterViewInit,
  AfterViewChecked
} from 'angular2/core';
import {Directive, Component, View, ViewMetadata} from 'angular2/src/core/metadata';

export function main() {
  describe('directive lifecycle integration spec', () => {

    it('should invoke lifecycle methods ngOnChanges > ngOnInit > ngDoCheck > ngAfterContentChecked',
       inject([TestComponentBuilder, Log, AsyncTestCompleter], (tcb: TestComponentBuilder, log: Log,
                                                                async) => {
         tcb.overrideView(
                MyComp,
                new ViewMetadata(
                    {template: '<div [field]="123" lifecycle></div>', directives: [LifecycleCmp]}))
             .createAsync(MyComp)
             .then((tc) => {
               tc.detectChanges();

               expect(log.result())
                   .toEqual(
                       "ngOnChanges; ngOnInit; ngDoCheck; ngAfterContentInit; ngAfterContentChecked; child_ngDoCheck; " +
                       "ngAfterViewInit; ngAfterViewChecked");

               log.clear();
               tc.detectChanges();

               expect(log.result())
                   .toEqual(
                       "ngDoCheck; ngAfterContentChecked; child_ngDoCheck; ngAfterViewChecked");

               async.done();
             });
       }));
  });
}


@Directive({selector: '[lifecycle-dir]'})
class LifecycleDir implements DoCheck {
  constructor(private _log: Log) {}
  ngDoCheck() { this._log.add("child_ngDoCheck"); }
}

@Component({selector: "[lifecycle]", inputs: ['field']})
@View({template: `<div lifecycle-dir></div>`, directives: [LifecycleDir]})
class LifecycleCmp implements OnChanges, OnInit, DoCheck, AfterContentInit, AfterContentChecked,
    AfterViewInit, AfterViewChecked {
  field;
  constructor(private _log: Log) {}

  ngOnChanges(_) { this._log.add("ngOnChanges"); }

  ngOnInit() { this._log.add("ngOnInit"); }

  ngDoCheck() { this._log.add("ngDoCheck"); }

  ngAfterContentInit() { this._log.add("ngAfterContentInit"); }

  ngAfterContentChecked() { this._log.add("ngAfterContentChecked"); }

  ngAfterViewInit() { this._log.add("ngAfterViewInit"); }

  ngAfterViewChecked() { this._log.add("ngAfterViewChecked"); }
}

@Component({selector: 'my-comp'})
@View({directives: []})
class MyComp {
}
