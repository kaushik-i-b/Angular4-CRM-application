import {
  AsyncTestCompleter,
  TestComponentBuilder,
  beforeEach,
  beforeEachProviders,
  ddescribe,
  describe,
  el,
  expect,
  iit,
  inject,
  it,
  xit,
} from 'angular2/testing_internal';

import {ListWrapper} from 'angular2/src/facade/collection';
import {Component, View, TemplateRef, ContentChild} from 'angular2/core';
import {NgFor} from 'angular2/src/common/directives/ng_for';
import {By} from 'angular2/platform/common_dom';

export function main() {
  describe('ngFor', () => {
    var TEMPLATE =
        '<div><copy-me template="ngFor #item of items">{{item.toString()}};</copy-me></div>';

    it('should reflect initial elements',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('1;2;');
               async.done();
             });
       }));

    it('should reflect added elements',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.detectChanges();

               (<number[]>fixture.debugElement.componentInstance.items).push(3);
               fixture.detectChanges();

               expect(fixture.debugElement.nativeElement).toHaveText('1;2;3;');
               async.done();
             });
       }));

    it('should reflect removed elements',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.detectChanges();

               ListWrapper.removeAt(fixture.debugElement.componentInstance.items, 1);
               fixture.detectChanges();

               expect(fixture.debugElement.nativeElement).toHaveText('1;');
               async.done();
             });
       }));

    it('should reflect moved elements',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.detectChanges();

               ListWrapper.removeAt(fixture.debugElement.componentInstance.items, 0);
               (<number[]>fixture.debugElement.componentInstance.items).push(1);
               fixture.detectChanges();

               expect(fixture.debugElement.nativeElement).toHaveText('2;1;');
               async.done();
             });
       }));

    it('should reflect a mix of all changes (additions/removals/moves)',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.debugElement.componentInstance.items = [0, 1, 2, 3, 4, 5];
               fixture.detectChanges();

               fixture.debugElement.componentInstance.items = [6, 2, 7, 0, 4, 8];
               fixture.detectChanges();

               expect(fixture.debugElement.nativeElement).toHaveText('6;2;7;0;4;8;');
               async.done();
             });
       }));

    it('should iterate over an array of objects',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template = '<ul><li template="ngFor #item of items">{{item["name"]}};</li></ul>';

         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {

               // INIT
               fixture.debugElement.componentInstance.items =
                   [{'name': 'misko'}, {'name': 'shyam'}];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('misko;shyam;');

               // GROW
               (<any[]>fixture.debugElement.componentInstance.items).push({'name': 'adam'});
               fixture.detectChanges();

               expect(fixture.debugElement.nativeElement).toHaveText('misko;shyam;adam;');

               // SHRINK
               ListWrapper.removeAt(fixture.debugElement.componentInstance.items, 2);
               ListWrapper.removeAt(fixture.debugElement.componentInstance.items, 0);
               fixture.detectChanges();

               expect(fixture.debugElement.nativeElement).toHaveText('shyam;');
               async.done();
             });
       }));

    it('should gracefully handle nulls',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template = '<ul><li template="ngFor #item of null">{{item}};</li></ul>';
         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('');
               async.done();
             });
       }));

    it('should gracefully handle ref changing to null and back',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('1;2;');

               fixture.debugElement.componentInstance.items = null;
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('');

               fixture.debugElement.componentInstance.items = [1, 2, 3];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('1;2;3;');
               async.done();
             });
       }));

    it('should throw on ref changing to string',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('1;2;');

               fixture.debugElement.componentInstance.items = 'whaaa';
               expect(() => fixture.detectChanges()).toThrowError();
               async.done();
             });
       }));

    it('should works with duplicates',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, TEMPLATE)
             .createAsync(TestComponent)
             .then((fixture) => {
               var a = new Foo();
               fixture.debugElement.componentInstance.items = [a, a];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('foo;foo;');
               async.done();
             });
       }));

    it('should repeat over nested arrays',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template = '<div>' +
                        '<div template="ngFor #item of items">' +
                        '<div template="ngFor #subitem of item">' +
                        '{{subitem}}-{{item.length}};' +
                        '</div>|' +
                        '</div>' +
                        '</div>';

         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.debugElement.componentInstance.items = [['a', 'b'], ['c']];
               fixture.detectChanges();
               fixture.detectChanges();
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('a-2;b-2;|c-1;|');

               fixture.debugElement.componentInstance.items = [['e'], ['f', 'g']];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('e-1;|f-2;g-2;|');

               async.done();
             });
       }));

    it('should repeat over nested arrays with no intermediate element',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template = '<div><template ngFor #item [ngForOf]="items">' +
                        '<div template="ngFor #subitem of item">' +
                        '{{subitem}}-{{item.length}};' +
                        '</div></template></div>';

         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.debugElement.componentInstance.items = [['a', 'b'], ['c']];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('a-2;b-2;c-1;');

               fixture.debugElement.componentInstance.items = [['e'], ['f', 'g']];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('e-1;f-2;g-2;');
               async.done();
             });
       }));

    it('should display indices correctly',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template =
             '<div><copy-me template="ngFor: var item of items; var i=index">{{i.toString()}}</copy-me></div>';

         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.debugElement.componentInstance.items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('0123456789');

               fixture.debugElement.componentInstance.items = [1, 2, 6, 7, 4, 3, 5, 8, 9, 0];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('0123456789');
               async.done();
             });
       }));

    it('should display last item correctly',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template =
             '<div><copy-me template="ngFor: var item of items; var isLast=last">{{isLast.toString()}}</copy-me></div>';

         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.debugElement.componentInstance.items = [0, 1, 2];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('falsefalsetrue');

               fixture.debugElement.componentInstance.items = [2, 1];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('falsetrue');
               async.done();
             });
       }));

    it('should display even items correctly',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template =
             '<div><copy-me template="ngFor: var item of items; var isEven=even">{{isEven.toString()}}</copy-me></div>';

         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.debugElement.componentInstance.items = [0, 1, 2];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('truefalsetrue');

               fixture.debugElement.componentInstance.items = [2, 1];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('truefalse');
               async.done();
             });
       }));

    it('should display odd items correctly',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template =
             '<div><copy-me template="ngFor: var item of items; var isOdd=odd">{{isOdd.toString()}}</copy-me></div>';

         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               fixture.debugElement.componentInstance.items = [0, 1, 2, 3];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('falsetruefalsetrue');

               fixture.debugElement.componentInstance.items = [2, 1];
               fixture.detectChanges();
               expect(fixture.debugElement.nativeElement).toHaveText('falsetrue');
               async.done();
             });
       }));

    it('should allow to use a custom template',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(
                TestComponent,
                '<ul><template ngFor [ngForOf]="items" [ngForTemplate]="contentTpl"></template></ul>')
             .overrideTemplate(
                 ComponentUsingTestComponent,
                 '<test-cmp><li template="#item #i=index">{{i}}: {{item}};</li></test-cmp>')
             .createAsync(ComponentUsingTestComponent)
             .then((fixture) => {
               var testComponent = fixture.debugElement.children[0];
               testComponent.componentInstance.items = ['a', 'b', 'c'];
               fixture.detectChanges();
               expect(testComponent.nativeElement).toHaveText('0: a;1: b;2: c;');

               async.done();
             });
       }));

    it('should use a default template if a custom one is null',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, `<ul><template ngFor #item [ngForOf]="items"
         [ngForTemplate]="contentTpl" #i="index">{{i}}: {{item}};</template></ul>`)
             .overrideTemplate(ComponentUsingTestComponent, '<test-cmp></test-cmp>')
             .createAsync(ComponentUsingTestComponent)
             .then((fixture) => {
               var testComponent = fixture.debugElement.children[0];
               testComponent.componentInstance.items = ['a', 'b', 'c'];
               fixture.detectChanges();
               expect(testComponent.nativeElement).toHaveText('0: a;1: b;2: c;');

               async.done();
             });
       }));

    it('should use a custom template when both default and a custom one are present',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         tcb.overrideTemplate(TestComponent, `<ul><template ngFor #item [ngForOf]="items"
         [ngForTemplate]="contentTpl" #i="index">{{i}}=> {{item}};</template></ul>`)
             .overrideTemplate(
                 ComponentUsingTestComponent,
                 '<test-cmp><li template="#item #i=index">{{i}}: {{item}};</li></test-cmp>')
             .createAsync(ComponentUsingTestComponent)
             .then((fixture) => {
               var testComponent = fixture.debugElement.children[0];
               testComponent.componentInstance.items = ['a', 'b', 'c'];
               fixture.detectChanges();
               expect(testComponent.nativeElement).toHaveText('0: a;1: b;2: c;');

               async.done();
             });
       }));

    it('should use custom track by if function is provided',
       inject([TestComponentBuilder, AsyncTestCompleter], (tcb: TestComponentBuilder, async) => {
         var template =
             `<template ngFor #item [ngForOf]="items" [ngForTrackBy]="customTrackBy" #i="index">
               <p>{{items[i]}}</p>
              </template>`;
         tcb.overrideTemplate(TestComponent, template)
             .createAsync(TestComponent)
             .then((fixture) => {
               var buildItemList =
                   () => {
                     fixture.debugElement.componentInstance.items = [{'id': 'a'}];
                     fixture.detectChanges();
                     return fixture.debugElement.queryAll(By.css('p'))[0];
                   }

               var firstP = buildItemList();
               var finalP = buildItemList();
               expect(finalP.nativeElement).toBe(firstP.nativeElement);
               async.done();
             });
       }));


  });
}

class Foo {
  toString() { return 'foo'; }
}

@Component({selector: 'test-cmp'})
@View({directives: [NgFor]})
class TestComponent {
  @ContentChild(TemplateRef) contentTpl: TemplateRef;
  items: any;
  constructor() { this.items = [1, 2]; }
  customTrackBy(index: number, item: any): string { return item['id']; }
}

@Component({selector: 'outer-cmp'})
@View({directives: [TestComponent]})
class ComponentUsingTestComponent {
  items: any;
  constructor() { this.items = [1, 2]; }
}
