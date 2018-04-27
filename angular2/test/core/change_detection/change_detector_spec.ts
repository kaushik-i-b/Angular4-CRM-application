import {
  ddescribe,
  describe,
  it,
  iit,
  xit,
  expect,
  beforeEach,
  afterEach,
  tick,
  fakeAsync
} from 'angular2/testing_internal';

import {SpyChangeDispatcher} from '../spies';

import {
  CONST_EXPR,
  isPresent,
  isBlank,
  isNumber,
  isJsObject,
  FunctionWrapper,
  NumberWrapper,
  normalizeBool
} from 'angular2/src/facade/lang';
import {BaseException, WrappedException} from 'angular2/src/facade/exceptions';
import {MapWrapper, StringMapWrapper} from 'angular2/src/facade/collection';
import {DOM} from 'angular2/src/platform/dom/dom_adapter';

import {
  ChangeDispatcher,
  DehydratedException,
  DynamicChangeDetector,
  ChangeDetectionError,
  BindingRecord,
  DirectiveRecord,
  DirectiveIndex,
  PipeTransform,
  ChangeDetectionStrategy,
  WrappedValue,
  DynamicProtoChangeDetector,
  ChangeDetectorDefinition,
  Lexer,
  Parser,
  Locals,
  ProtoChangeDetector
} from 'angular2/src/core/change_detection/change_detection';

import {SelectedPipe, Pipes} from 'angular2/src/core/change_detection/pipes';
import {JitProtoChangeDetector} from 'angular2/src/core/change_detection/jit_proto_change_detector';
import {OnDestroy} from 'angular2/src/core/linker/interfaces';

import {getDefinition} from './change_detector_config';
import {createObservableModel} from './change_detector_spec_util';
import {getFactoryById} from './generated/change_detector_classes';
import {IS_DART} from 'angular2/src/facade/lang';
import {EventEmitter, ObservableWrapper} from 'angular2/src/facade/async';

const _DEFAULT_CONTEXT = CONST_EXPR(new Object());

/**
 * Tests in this spec run against three different implementations of `AbstractChangeDetector`,
 * `dynamic` (which use reflection to inspect objects), `JIT` (which are generated only for
 * Javascript at runtime using `eval`) and `Pregen` (which are generated only for Dart prior
 * to app deploy to avoid the need for reflection).
 *
 * Pre-generated classes require knowledge of the shape of the change detector at the time of Dart
 * transformation, so in these tests we abstract a `ChangeDetectorDefinition` out into the
 * change_detector_config library and define a build step which pre-generates the necessary change
 * detectors to execute these tests. Once that built step has run, those generated change detectors
 * can be found in the generated/change_detector_classes library.
 */
export function main() {
  ['dynamic', 'JIT', 'Pregen'].forEach(cdType => {
    if (cdType == "JIT" && IS_DART) return;
    if (cdType == "Pregen" && !IS_DART) return;

    describe(`${cdType} Change Detector`, () => {

      function _getChangeDetectorFactory(def: ChangeDetectorDefinition) {
        switch (cdType) {
          case 'dynamic':
            var dynProto = new DynamicProtoChangeDetector(def);
            return () => dynProto.instantiate();
          case 'JIT':
            var jitProto = new JitProtoChangeDetector(def);
            return () => jitProto.instantiate();
          case 'Pregen':
            return getFactoryById(def.id);
          default:
            return null;
        }
      }

      function _createWithoutHydrate(expression: string) {
        var dispatcher = new TestDispatcher();
        var cd = _getChangeDetectorFactory(getDefinition(expression).cdDef)();
        return new _ChangeDetectorAndDispatcher(cd, dispatcher);
      }


      function _createChangeDetector(expression: string, context = _DEFAULT_CONTEXT,
                                     registry = null, dispatcher = null) {
        if (isBlank(dispatcher)) dispatcher = new TestDispatcher();
        var testDef = getDefinition(expression);
        var cd = _getChangeDetectorFactory(testDef.cdDef)();
        cd.hydrate(context, testDef.locals, dispatcher, registry);
        return new _ChangeDetectorAndDispatcher(cd, dispatcher);
      }

      function _bindSimpleValue(expression: string, context = _DEFAULT_CONTEXT) {
        var val = _createChangeDetector(expression, context);
        val.changeDetector.detectChanges();
        return val.dispatcher.log;
      }

      describe('short-circuit', () => {
        it('should support short-circuit for the ternary operator', () => {
          var address = new Address('Sunnyvale', '94085');
          expect(_bindSimpleValue('true ? city : zipcode', address))
              .toEqual(['propName=Sunnyvale']);
          expect(address.cityGetterCalls).toEqual(1);
          expect(address.zipCodeGetterCalls).toEqual(0);

          address = new Address('Sunnyvale', '94085');
          expect(_bindSimpleValue('false ? city : zipcode', address)).toEqual(['propName=94085']);
          expect(address.cityGetterCalls).toEqual(0);
          expect(address.zipCodeGetterCalls).toEqual(1);
        });

        it('should support short-circuit for the && operator', () => {
          var logical = new Logical();
          expect(_bindSimpleValue('getTrue() && getTrue()', logical)).toEqual(['propName=true']);
          expect(logical.trueCalls).toEqual(2);

          logical = new Logical();
          expect(_bindSimpleValue('getFalse() && getTrue()', logical)).toEqual(['propName=false']);
          expect(logical.falseCalls).toEqual(1);
          expect(logical.trueCalls).toEqual(0);
        });

        it('should support short-circuit for the || operator', () => {
          var logical = new Logical();
          expect(_bindSimpleValue('getFalse() || getFalse()', logical)).toEqual(['propName=false']);
          expect(logical.falseCalls).toEqual(2);

          logical = new Logical();
          expect(_bindSimpleValue('getTrue() || getFalse()', logical)).toEqual(['propName=true']);
          expect(logical.falseCalls).toEqual(0);
          expect(logical.trueCalls).toEqual(1);
        });

        it('should support nested short-circuits', () => {
          var address = new Address('Sunnyvale', '94085');
          var person = new Person('Victor', address);
          expect(_bindSimpleValue(
                     'name == "Victor" ? (true ? address.city : address.zipcode) : address.zipcode',
                     person))
              .toEqual(['propName=Sunnyvale']);
          expect(address.cityGetterCalls).toEqual(1);
          expect(address.zipCodeGetterCalls).toEqual(0);
        });
      });

      it('should support literals',
         () => { expect(_bindSimpleValue('10')).toEqual(['propName=10']); });

      it('should strip quotes from literals',
         () => { expect(_bindSimpleValue('"str"')).toEqual(['propName=str']); });

      it('should support newlines in literals',
         () => { expect(_bindSimpleValue('"a\n\nb"')).toEqual(['propName=a\n\nb']); });

      it('should support + operations',
         () => { expect(_bindSimpleValue('10 + 2')).toEqual(['propName=12']); });

      it('should support - operations',
         () => { expect(_bindSimpleValue('10 - 2')).toEqual(['propName=8']); });

      it('should support * operations',
         () => { expect(_bindSimpleValue('10 * 2')).toEqual(['propName=20']); });

      it('should support / operations', () => {
        expect(_bindSimpleValue('10 / 2')).toEqual([`propName=${5.0}`]);
      });  // dart exp=5.0, js exp=5

      it('should support % operations',
         () => { expect(_bindSimpleValue('11 % 2')).toEqual(['propName=1']); });

      it('should support == operations on identical',
         () => { expect(_bindSimpleValue('1 == 1')).toEqual(['propName=true']); });

      it('should support != operations',
         () => { expect(_bindSimpleValue('1 != 1')).toEqual(['propName=false']); });

      it('should support == operations on coerceible', () => {
        var expectedValue = IS_DART ? 'false' : 'true';
        expect(_bindSimpleValue('1 == true')).toEqual([`propName=${expectedValue}`]);
      });

      it('should support === operations on identical',
         () => { expect(_bindSimpleValue('1 === 1')).toEqual(['propName=true']); });

      it('should support !== operations',
         () => { expect(_bindSimpleValue('1 !== 1')).toEqual(['propName=false']); });

      it('should support === operations on coerceible',
         () => { expect(_bindSimpleValue('1 === true')).toEqual(['propName=false']); });

      it('should support true < operations',
         () => { expect(_bindSimpleValue('1 < 2')).toEqual(['propName=true']); });

      it('should support false < operations',
         () => { expect(_bindSimpleValue('2 < 1')).toEqual(['propName=false']); });

      it('should support false > operations',
         () => { expect(_bindSimpleValue('1 > 2')).toEqual(['propName=false']); });

      it('should support true > operations',
         () => { expect(_bindSimpleValue('2 > 1')).toEqual(['propName=true']); });

      it('should support true <= operations',
         () => { expect(_bindSimpleValue('1 <= 2')).toEqual(['propName=true']); });

      it('should support equal <= operations',
         () => { expect(_bindSimpleValue('2 <= 2')).toEqual(['propName=true']); });

      it('should support false <= operations',
         () => { expect(_bindSimpleValue('2 <= 1')).toEqual(['propName=false']); });

      it('should support true >= operations',
         () => { expect(_bindSimpleValue('2 >= 1')).toEqual(['propName=true']); });

      it('should support equal >= operations',
         () => { expect(_bindSimpleValue('2 >= 2')).toEqual(['propName=true']); });

      it('should support false >= operations',
         () => { expect(_bindSimpleValue('1 >= 2')).toEqual(['propName=false']); });

      it('should support true && operations',
         () => { expect(_bindSimpleValue('true && true')).toEqual(['propName=true']); });

      it('should support false && operations',
         () => { expect(_bindSimpleValue('true && false')).toEqual(['propName=false']); });

      it('should support true || operations',
         () => { expect(_bindSimpleValue('true || false')).toEqual(['propName=true']); });

      it('should support false || operations',
         () => { expect(_bindSimpleValue('false || false')).toEqual(['propName=false']); });

      it('should support negate',
         () => { expect(_bindSimpleValue('!true')).toEqual(['propName=false']); });

      it('should support double negate',
         () => { expect(_bindSimpleValue('!!true')).toEqual(['propName=true']); });

      it('should support true conditionals',
         () => { expect(_bindSimpleValue('1 < 2 ? 1 : 2')).toEqual(['propName=1']); });

      it('should support false conditionals',
         () => { expect(_bindSimpleValue('1 > 2 ? 1 : 2')).toEqual(['propName=2']); });

      it('should support keyed access to a list item',
         () => { expect(_bindSimpleValue('["foo", "bar"][0]')).toEqual(['propName=foo']); });

      it('should support keyed access to a map item',
         () => { expect(_bindSimpleValue('{"foo": "bar"}["foo"]')).toEqual(['propName=bar']); });

      it('should report all changes on the first run including uninitialized values', () => {
        expect(_bindSimpleValue('value', new Uninitialized())).toEqual(['propName=null']);
      });

      it('should report all changes on the first run including null values', () => {
        var td = new TestData(null);
        expect(_bindSimpleValue('a', td)).toEqual(['propName=null']);
      });

      it('should support simple chained property access', () => {
        var address = new Address('Grenoble');
        var person = new Person('Victor', address);

        expect(_bindSimpleValue('address.city', person)).toEqual(['propName=Grenoble']);
      });

      it('should support the safe navigation operator', () => {
        var person = new Person('Victor', null);

        expect(_bindSimpleValue('address?.city', person)).toEqual(['propName=null']);
        expect(_bindSimpleValue('address?.toString()', person)).toEqual(['propName=null']);

        person.address = new Address('MTV');

        expect(_bindSimpleValue('address?.city', person)).toEqual(['propName=MTV']);
        expect(_bindSimpleValue('address?.toString()', person)).toEqual(['propName=MTV']);
      });

      it('should support method calls', () => {
        var person = new Person('Victor');
        expect(_bindSimpleValue('sayHi("Jim")', person)).toEqual(['propName=Hi, Jim']);
      });

      it('should support function calls', () => {
        var td = new TestData(() => (a) => a);
        expect(_bindSimpleValue('a()(99)', td)).toEqual(['propName=99']);
      });

      it('should support chained method calls', () => {
        var person = new Person('Victor');
        var td = new TestData(person);
        expect(_bindSimpleValue('a.sayHi("Jim")', td)).toEqual(['propName=Hi, Jim']);
      });

      it('should support NaN', () => {
        var person = new Person('misko');
        person.age = NumberWrapper.NaN;
        var val = _createChangeDetector('age', person);

        val.changeDetector.detectChanges();
        expect(val.dispatcher.log).toEqual(['propName=NaN']);
        val.dispatcher.clear();

        val.changeDetector.detectChanges();
        expect(val.dispatcher.log).toEqual([]);
      });

      it('should do simple watching', () => {
        var person = new Person('misko');
        var val = _createChangeDetector('name', person);

        val.changeDetector.detectChanges();
        expect(val.dispatcher.log).toEqual(['propName=misko']);
        val.dispatcher.clear();

        val.changeDetector.detectChanges();
        expect(val.dispatcher.log).toEqual([]);
        val.dispatcher.clear();

        person.name = 'Misko';
        val.changeDetector.detectChanges();
        expect(val.dispatcher.log).toEqual(['propName=Misko']);
      });

      it('should support literal array', () => {
        var val = _createChangeDetector('[1, 2]');
        val.changeDetector.detectChanges();
        expect(val.dispatcher.loggedValues).toEqual([[1, 2]]);

        val = _createChangeDetector('[1, a]', new TestData(2));
        val.changeDetector.detectChanges();
        expect(val.dispatcher.loggedValues).toEqual([[1, 2]]);
      });

      it('should support literal maps', () => {
        var val = _createChangeDetector('{z: 1}');
        val.changeDetector.detectChanges();
        expect(val.dispatcher.loggedValues[0]['z']).toEqual(1);

        val = _createChangeDetector('{z: a}', new TestData(1));
        val.changeDetector.detectChanges();
        expect(val.dispatcher.loggedValues[0]['z']).toEqual(1);
      });

      it('should support interpolation', () => {
        var val = _createChangeDetector('interpolation', new TestData('value'));

        val.changeDetector.detectChanges();

        expect(val.dispatcher.log).toEqual(['propName=BvalueA']);
      });

      it('should output empty strings for null values in interpolation', () => {
        var val = _createChangeDetector('interpolation', new TestData(null));

        val.changeDetector.detectChanges();

        expect(val.dispatcher.log).toEqual(['propName=BA']);
      });

      it('should escape values in literals that indicate interpolation',
         () => { expect(_bindSimpleValue('"$"')).toEqual(['propName=$']); });

      describe('pure functions', () => {
        it('should preserve memoized result', () => {
          var person = new Person('bob');
          var val = _createChangeDetector('passThrough([12])', person);
          val.changeDetector.detectChanges();
          val.changeDetector.detectChanges();
          expect(val.dispatcher.loggedValues).toEqual([[12]]);
        });
      });

      describe('change notification', () => {
        describe('simple checks', () => {
          it('should pass a change record to the dispatcher', () => {
            var person = new Person('bob');
            var val = _createChangeDetector('name', person);
            val.changeDetector.detectChanges();
            expect(val.dispatcher.loggedValues).toEqual(['bob']);
          });
        });

        describe('pipes', () => {
          it('should pass a change record to the dispatcher', () => {
            var registry = new FakePipes('pipe', () => new CountingPipe());
            var person = new Person('bob');
            var val = _createChangeDetector('name | pipe', person, registry);
            val.changeDetector.detectChanges();
            expect(val.dispatcher.loggedValues).toEqual(['bob state:0']);
          });

          it('should support arguments in pipes', () => {
            var registry = new FakePipes('pipe', () => new MultiArgPipe());
            var address = new Address('two');
            var person = new Person('value', address);
            var val = _createChangeDetector("name | pipe:'one':address.city", person, registry);
            val.changeDetector.detectChanges();
            expect(val.dispatcher.loggedValues).toEqual(['value one two default']);
          });

          it('should associate pipes right-to-left', () => {
            var registry = new FakePipes('pipe', () => new MultiArgPipe());
            var person = new Person('value');
            var val = _createChangeDetector("name | pipe:'a':'b' | pipe:0:1:2", person, registry);
            val.changeDetector.detectChanges();
            expect(val.dispatcher.loggedValues).toEqual(['value a b default 0 1 2']);
          });

          it('should not reevaluate pure pipes unless its context or arg changes', () => {
            var pipe = new CountingPipe();
            var registry = new FakePipes('pipe', () => pipe, {pure: true});
            var person = new Person('bob');
            var val = _createChangeDetector('name | pipe', person, registry);

            val.changeDetector.detectChanges();
            expect(pipe.state).toEqual(1);

            val.changeDetector.detectChanges();
            expect(pipe.state).toEqual(1);

            person.name = 'jim';
            val.changeDetector.detectChanges();
            expect(pipe.state).toEqual(2);
          });

          it('should reevaluate impure pipes neither context nor arg changes', () => {
            var pipe = new CountingPipe();
            var registry = new FakePipes('pipe', () => pipe, {pure: false});
            var person = new Person('bob');
            var val = _createChangeDetector('name | pipe', person, registry);

            val.changeDetector.detectChanges();
            expect(pipe.state).toEqual(1);

            val.changeDetector.detectChanges();
            expect(pipe.state).toEqual(2);
          });

          it('should support pipes as arguments to pure functions', () => {
            var registry = new FakePipes('pipe', () => new IdentityPipe());
            var person = new Person('bob');
            var val = _createChangeDetector('(name | pipe).length', person, registry);
            val.changeDetector.detectChanges();
            expect(val.dispatcher.loggedValues).toEqual([3]);
          });
        });

        it('should notify the dispatcher after content children have checked', () => {
          var val = _createChangeDetector('name', new Person('bob'));
          val.changeDetector.detectChanges();
          expect(val.dispatcher.ngAfterContentCheckedCalled).toEqual(true);
        });

        it('should notify the dispatcher after view children have been checked', () => {
          var val = _createChangeDetector('name', new Person('bob'));
          val.changeDetector.detectChanges();
          expect(val.dispatcher.ngAfterViewCheckedCalled).toEqual(true);
        });

        describe('updating directives', () => {
          var directive1;
          var directive2;
          var directive3;

          beforeEach(() => {
            directive1 = new TestDirective();
            directive2 = new TestDirective();
            directive3 = new TestDirective(null, null, true);
          });

          it('should happen directly, without invoking the dispatcher', () => {
            var val = _createWithoutHydrate('directNoDispatcher');
            val.changeDetector.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []),
                                       null);
            val.changeDetector.detectChanges();
            expect(val.dispatcher.loggedValues).toEqual([]);
            expect(directive1.a).toEqual(42);
          });

          describe('lifecycle', () => {
            describe('ngOnChanges', () => {
              it('should notify the directive when a group of records changes', () => {
                var cd = _createWithoutHydrate('groupChanges').changeDetector;
                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1, directive2], []),
                           null);
                cd.detectChanges();
                expect(directive1.changes).toEqual({'a': 1, 'b': 2});
                expect(directive2.changes).toEqual({'a': 3});
              });
            });

            describe('ngDoCheck', () => {
              it('should notify the directive when it is checked', () => {
                var cd = _createWithoutHydrate('directiveDoCheck').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []), null);
                cd.detectChanges();

                expect(directive1.ngDoCheckCalled).toBe(true);
                directive1.ngDoCheckCalled = false;

                cd.detectChanges();
                expect(directive1.ngDoCheckCalled).toBe(true);
              });

              it('should not call ngDoCheck in detectNoChanges', () => {
                var cd = _createWithoutHydrate('directiveDoCheck').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []), null);

                cd.checkNoChanges();

                expect(directive1.ngDoCheckCalled).toBe(false);
              });
            });

            describe('ngOnInit', () => {
              it('should notify the directive after it has been checked the first time', () => {
                var cd = _createWithoutHydrate('directiveOnInit').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1, directive2], []),
                           null);

                cd.detectChanges();

                expect(directive1.ngOnInitCalled).toBe(true);

                directive1.ngOnInitCalled = false;

                cd.detectChanges();

                expect(directive1.ngOnInitCalled).toBe(false);
              });

              it('should not call ngOnInit in detectNoChanges', () => {
                var cd = _createWithoutHydrate('directiveOnInit').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []), null);

                cd.checkNoChanges();

                expect(directive1.ngOnInitCalled).toBe(false);
              });

              it('should not call ngOnInit again if it throws', () => {
                var cd = _createWithoutHydrate('directiveOnInit').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive3], []), null);
                var errored = false;
                // First pass fails, but ngOnInit should be called.
                try {
                  cd.detectChanges();
                } catch (e) {
                  errored = true;
                }
                expect(errored).toBe(true);
                expect(directive3.ngOnInitCalled).toBe(true);
                directive3.ngOnInitCalled = false;

                // Second change detection also fails, but this time ngOnInit should not be called.
                try {
                  cd.detectChanges();
                } catch (e) {
                  throw new BaseException("Second detectChanges() should not have run detection.");
                }
                expect(directive3.ngOnInitCalled).toBe(false);
              });
            });

            describe('ngAfterContentInit', () => {
              it('should be called after processing the content children', () => {
                var cd = _createWithoutHydrate('emptyWithDirectiveRecords').changeDetector;
                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1, directive2], []),
                           null);

                cd.detectChanges();

                expect(directive1.ngAfterContentInitCalled).toBe(true);
                expect(directive2.ngAfterContentInitCalled).toBe(true);

                // reset directives
                directive1.ngAfterContentInitCalled = false;
                directive2.ngAfterContentInitCalled = false;

                // Verify that checking should not call them.
                cd.checkNoChanges();

                expect(directive1.ngAfterContentInitCalled).toBe(false);
                expect(directive2.ngAfterContentInitCalled).toBe(false);

                // re-verify that changes should not call them
                cd.detectChanges();

                expect(directive1.ngAfterContentInitCalled).toBe(false);
                expect(directive2.ngAfterContentInitCalled).toBe(false);
              });

              it('should not be called when ngAfterContentInit is false', () => {
                var cd = _createWithoutHydrate('noCallbacks').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []), null);

                cd.detectChanges();

                expect(directive1.ngAfterContentInitCalled).toEqual(false);
              });
            });

            describe('ngAfterContentChecked', () => {
              it('should be called after processing all the children', () => {
                var cd = _createWithoutHydrate('emptyWithDirectiveRecords').changeDetector;
                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1, directive2], []),
                           null);

                cd.detectChanges();

                expect(directive1.ngAfterContentCheckedCalled).toBe(true);
                expect(directive2.ngAfterContentCheckedCalled).toBe(true);

                // reset directives
                directive1.ngAfterContentCheckedCalled = false;
                directive2.ngAfterContentCheckedCalled = false;

                // Verify that checking should not call them.
                cd.checkNoChanges();

                expect(directive1.ngAfterContentCheckedCalled).toBe(false);
                expect(directive2.ngAfterContentCheckedCalled).toBe(false);

                // re-verify that changes are still detected
                cd.detectChanges();

                expect(directive1.ngAfterContentCheckedCalled).toBe(true);
                expect(directive2.ngAfterContentCheckedCalled).toBe(true);
              });

              it('should not be called when ngAfterContentChecked is false', () => {
                var cd = _createWithoutHydrate('noCallbacks').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []), null);

                cd.detectChanges();

                expect(directive1.ngAfterContentCheckedCalled).toEqual(false);
              });

              it('should be called in reverse order so the child is always notified before the parent',
                 () => {
                   var cd = _createWithoutHydrate('emptyWithDirectiveRecords').changeDetector;

                   var ngOnChangesDoneCalls = [];
                   var td1;
                   td1 = new TestDirective(() => ngOnChangesDoneCalls.push(td1));
                   var td2;
                   td2 = new TestDirective(() => ngOnChangesDoneCalls.push(td2));
                   cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([td1, td2], []), null);

                   cd.detectChanges();

                   expect(ngOnChangesDoneCalls).toEqual([td2, td1]);
                 });

              it('should be called before processing view children', () => {
                var parent = _createWithoutHydrate('directNoDispatcher').changeDetector;
                var child = _createWithoutHydrate('directNoDispatcher').changeDetector;
                parent.addViewChild(child);

                var orderOfOperations = [];

                var directiveInShadowDom;
                directiveInShadowDom =
                    new TestDirective(() => { orderOfOperations.push(directiveInShadowDom); });
                var parentDirective;
                parentDirective =
                    new TestDirective(() => { orderOfOperations.push(parentDirective); });

                parent.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([parentDirective], []),
                               null);
                child.hydrate(_DEFAULT_CONTEXT, null,
                              new TestDispatcher([directiveInShadowDom], []), null);

                parent.detectChanges();
                expect(orderOfOperations).toEqual([parentDirective, directiveInShadowDom]);
              });
            });


            describe('ngAfterViewInit', () => {
              it('should be called after processing the view children', () => {
                var cd = _createWithoutHydrate('emptyWithDirectiveRecords').changeDetector;
                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1, directive2], []),
                           null);

                cd.detectChanges();

                expect(directive1.ngAfterViewInitCalled).toBe(true);
                expect(directive2.ngAfterViewInitCalled).toBe(true);

                // reset directives
                directive1.ngAfterViewInitCalled = false;
                directive2.ngAfterViewInitCalled = false;

                // Verify that checking should not call them.
                cd.checkNoChanges();

                expect(directive1.ngAfterViewInitCalled).toBe(false);
                expect(directive2.ngAfterViewInitCalled).toBe(false);

                // re-verify that changes should not call them
                cd.detectChanges();

                expect(directive1.ngAfterViewInitCalled).toBe(false);
                expect(directive2.ngAfterViewInitCalled).toBe(false);
              });


              it('should not be called when ngAfterViewInit is false', () => {
                var cd = _createWithoutHydrate('noCallbacks').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []), null);

                cd.detectChanges();

                expect(directive1.ngAfterViewInitCalled).toEqual(false);
              });
            });

            describe('ngAfterViewChecked', () => {
              it('should be called after processing the view children', () => {
                var cd = _createWithoutHydrate('emptyWithDirectiveRecords').changeDetector;
                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1, directive2], []),
                           null);

                cd.detectChanges();

                expect(directive1.ngAfterViewCheckedCalled).toBe(true);
                expect(directive2.ngAfterViewCheckedCalled).toBe(true);

                // reset directives
                directive1.ngAfterViewCheckedCalled = false;
                directive2.ngAfterViewCheckedCalled = false;

                // Verify that checking should not call them.
                cd.checkNoChanges();

                expect(directive1.ngAfterViewCheckedCalled).toBe(false);
                expect(directive2.ngAfterViewCheckedCalled).toBe(false);

                // re-verify that changes should call them
                cd.detectChanges();

                expect(directive1.ngAfterViewCheckedCalled).toBe(true);
                expect(directive2.ngAfterViewCheckedCalled).toBe(true);
              });

              it('should not be called when ngAfterViewChecked is false', () => {
                var cd = _createWithoutHydrate('noCallbacks').changeDetector;

                cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([directive1], []), null);

                cd.detectChanges();

                expect(directive1.ngAfterViewCheckedCalled).toEqual(false);
              });

              it('should be called in reverse order so the child is always notified before the parent',
                 () => {
                   var cd = _createWithoutHydrate('emptyWithDirectiveRecords').changeDetector;

                   var ngOnChangesDoneCalls = [];
                   var td1;
                   td1 = new TestDirective(null, () => ngOnChangesDoneCalls.push(td1));
                   var td2;
                   td2 = new TestDirective(null, () => ngOnChangesDoneCalls.push(td2));
                   cd.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([td1, td2], []), null);

                   cd.detectChanges();

                   expect(ngOnChangesDoneCalls).toEqual([td2, td1]);
                 });

              it('should be called after processing view children', () => {
                var parent = _createWithoutHydrate('directNoDispatcher').changeDetector;
                var child = _createWithoutHydrate('directNoDispatcher').changeDetector;
                parent.addViewChild(child);

                var orderOfOperations = [];

                var directiveInShadowDom;
                directiveInShadowDom = new TestDirective(
                    null, () => { orderOfOperations.push(directiveInShadowDom); });
                var parentDirective;
                parentDirective =
                    new TestDirective(null, () => { orderOfOperations.push(parentDirective); });

                parent.hydrate(_DEFAULT_CONTEXT, null, new TestDispatcher([parentDirective], []),
                               null);
                child.hydrate(_DEFAULT_CONTEXT, null,
                              new TestDispatcher([directiveInShadowDom], []), null);

                parent.detectChanges();
                expect(orderOfOperations).toEqual([directiveInShadowDom, parentDirective]);
              });
            });

            describe('ngOnDestroy', () => {
              it('should be called on dehydration', () => {
                var cd = _createChangeDetector('emptyWithDirectiveRecords', _DEFAULT_CONTEXT, null,
                                               new TestDispatcher([directive1, directive2], []))
                             .changeDetector;

                cd.dehydrate();

                expect(directive1.destroyCalled).toBe(true);
                expect(directive2.destroyCalled).toBe(true);
              });
            });

          });

        });
      });

      describe("logBindingUpdate", () => {
        it('should be called for element updates in the dev mode', () => {
          var person = new Person('bob');
          var val = _createChangeDetector('name', person);
          val.changeDetector.detectChanges();
          expect(val.dispatcher.debugLog).toEqual(['propName=bob']);
        });

        it('should be called for directive updates in the dev mode', () => {
          var val = _createChangeDetector('directNoDispatcher', _DEFAULT_CONTEXT, null,
                                          new TestDispatcher([new TestDirective()], []));
          val.changeDetector.detectChanges();
          expect(val.dispatcher.debugLog).toEqual(["a=42"]);
        });

        it('should not be called in the prod mode', () => {
          var person = new Person('bob');
          var val = _createChangeDetector('updateElementProduction', person);
          val.changeDetector.detectChanges();
          expect(val.dispatcher.debugLog).toEqual([]);
        });

      });

      describe('reading directives', () => {
        it('should read directive properties', () => {
          var directive = new TestDirective();
          directive.a = 'aaa';

          var val = _createChangeDetector('readingDirectives', _DEFAULT_CONTEXT, null,
                                          new TestDispatcher([directive], []));

          val.changeDetector.detectChanges();

          expect(val.dispatcher.loggedValues).toEqual(['aaa']);
        });
      });

      describe('enforce no new changes', () => {
        it('should throw when a record gets changed after it has been checked', () => {
          var val = _createChangeDetector('a', new TestData('value'));
          expect(() => { val.changeDetector.checkNoChanges(); })
              .toThrowError(new RegExp(
                  'Expression [\'"]a in location[\'"] has changed after it was checked'));
        });

        it('should not throw when two arrays are structurally the same', () => {
          var val = _createChangeDetector('a', new TestDataWithGetter(() => ['value']));
          val.changeDetector.detectChanges();

          expect(() => { val.changeDetector.checkNoChanges(); }).not.toThrow();
        });

        it('should not break the next run', () => {
          var val = _createChangeDetector('a', new TestData('value'));
          expect(() => val.changeDetector.checkNoChanges())
              .toThrowError(new RegExp(
                  'Expression [\'"]a in location[\'"] has changed after it was checked.'));

          val.changeDetector.detectChanges();
          expect(val.dispatcher.loggedValues).toEqual(['value']);
        });
      });

      describe('error handling', () => {
        it('should wrap exceptions into ChangeDetectionError', () => {
          var val = _createChangeDetector('invalidFn(1)');
          try {
            val.changeDetector.detectChanges();
            throw new BaseException('fail');
          } catch (e) {
            expect(e).toBeAnInstanceOf(ChangeDetectionError);
            expect(e.location).toEqual('invalidFn(1) in location');
          }
        });

        it('should handle unexpected errors in the event handler itself', () => {
          var throwingDispatcher = new SpyChangeDispatcher();
          throwingDispatcher.spy("getDebugContext")
              .andCallFake((_, __) => { throw new BaseException('boom'); });

          var val =
              _createChangeDetector('invalidFn(1)', _DEFAULT_CONTEXT, null, throwingDispatcher);
          try {
            val.changeDetector.detectChanges();
            throw new BaseException('fail');
          } catch (e) {
            expect(e).toBeAnInstanceOf(ChangeDetectionError);
            expect(e.location).toEqual(null);
          }
        });
      });

      describe('Locals', () => {
        it('should read a value from locals',
           () => { expect(_bindSimpleValue('valueFromLocals')).toEqual(['propName=value']); });

        it('should invoke a function from local',
           () => { expect(_bindSimpleValue('functionFromLocals')).toEqual(['propName=value']); });

        it('should handle nested locals',
           () => { expect(_bindSimpleValue('nestedLocals')).toEqual(['propName=value']); });

        it('should fall back to a regular field read when the locals map' +
               'does not have the requested field',
           () => {
             expect(_bindSimpleValue('fallbackLocals', new Person('Jim')))
                 .toEqual(['propName=Jim']);
           });

        it('should correctly handle nested properties', () => {
          var address = new Address('Grenoble');
          var person = new Person('Victor', address);

          expect(_bindSimpleValue('contextNestedPropertyWithLocals', person))
              .toEqual(['propName=Grenoble']);
          expect(_bindSimpleValue('localPropertyWithSimilarContext', person))
              .toEqual(['propName=MTV']);
        });
      });

      describe('handle children', () => {
        var parent, child;

        beforeEach(() => {
          parent = _createChangeDetector('10').changeDetector;
          child = _createChangeDetector('"str"').changeDetector;
        });

        it('should add content children', () => {
          parent.addContentChild(child);

          expect(parent.contentChildren.length).toEqual(1);
          expect(parent.contentChildren[0]).toBe(child);
        });

        it('should add view children', () => {
          parent.addViewChild(child);

          expect(parent.viewChildren.length).toEqual(1);
          expect(parent.viewChildren[0]).toBe(child);
        });

        it('should remove content children', () => {
          parent.addContentChild(child);
          parent.removeContentChild(child);

          expect(parent.contentChildren).toEqual([]);
        });

        it('should remove view children', () => {
          parent.addViewChild(child);
          parent.removeViewChild(child);

          expect(parent.viewChildren.length).toEqual(0);
        });
      });

      describe('mode', () => {
        it('should set the mode to CheckAlways when the default change detection is used', () => {
          var cd = _createWithoutHydrate('emptyUsingDefaultStrategy').changeDetector;
          expect(cd.mode).toEqual(null);

          cd.hydrate(_DEFAULT_CONTEXT, null, null, null);
          expect(cd.mode).toEqual(ChangeDetectionStrategy.CheckAlways);
        });

        it('should set the mode to CheckOnce when the push change detection is used', () => {
          var cd = _createWithoutHydrate('emptyUsingOnPushStrategy').changeDetector;
          cd.hydrate(_DEFAULT_CONTEXT, null, null, null);

          expect(cd.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
        });

        it('should not check a detached change detector', () => {
          var val = _createChangeDetector('a', _DEFAULT_CONTEXT);

          val.changeDetector.hydrate(_DEFAULT_CONTEXT, null, null, null);
          val.changeDetector.mode = ChangeDetectionStrategy.Detached;
          val.changeDetector.detectChanges();

          expect(val.dispatcher.log).toEqual([]);
        });

        it('should not check a checked change detector', () => {
          var val = _createChangeDetector('a', new TestData('value'));

          val.changeDetector.hydrate(_DEFAULT_CONTEXT, null, null, null);
          val.changeDetector.mode = ChangeDetectionStrategy.Checked;
          val.changeDetector.detectChanges();

          expect(val.dispatcher.log).toEqual([]);
        });

        it('should change CheckOnce to Checked', () => {
          var cd = _createChangeDetector('10', _DEFAULT_CONTEXT).changeDetector;
          cd.mode = ChangeDetectionStrategy.CheckOnce;

          cd.detectChanges();

          expect(cd.mode).toEqual(ChangeDetectionStrategy.Checked);
        });

        it('should not change the CheckAlways', () => {
          var cd = _createChangeDetector('10', _DEFAULT_CONTEXT).changeDetector;
          cd.mode = ChangeDetectionStrategy.CheckAlways;

          cd.detectChanges();

          expect(cd.mode).toEqual(ChangeDetectionStrategy.CheckAlways);
        });

        describe('marking OnPush detectors as CheckOnce after an update', () => {
          var childDirectiveDetectorRegular;
          var childDirectiveDetectorOnPush;
          var directives;

          beforeEach(() => {
            childDirectiveDetectorRegular = _createWithoutHydrate('10').changeDetector;
            childDirectiveDetectorRegular.hydrate(_DEFAULT_CONTEXT, null, null, null);
            childDirectiveDetectorRegular.mode = ChangeDetectionStrategy.CheckAlways;

            childDirectiveDetectorOnPush =
                _createWithoutHydrate('emptyUsingOnPushStrategy').changeDetector;
            childDirectiveDetectorOnPush.hydrate(_DEFAULT_CONTEXT, null, null, null);
            childDirectiveDetectorOnPush.mode = ChangeDetectionStrategy.Checked;

            directives =
                new TestDispatcher([new TestData(null), new TestData(null)],
                                   [childDirectiveDetectorRegular, childDirectiveDetectorOnPush]);
          });

          it('should set the mode to CheckOnce when a binding is updated', () => {
            var parentDetector =
                _createWithoutHydrate('onPushRecordsUsingDefaultStrategy').changeDetector;
            parentDetector.hydrate(_DEFAULT_CONTEXT, null, directives, null);

            parentDetector.detectChanges();

            // making sure that we only change the status of OnPush components
            expect(childDirectiveDetectorRegular.mode).toEqual(ChangeDetectionStrategy.CheckAlways);

            expect(childDirectiveDetectorOnPush.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
          });

          it('should mark OnPush detectors as CheckOnce after an event', () => {
            var cd = _createWithoutHydrate('onPushWithEvent').changeDetector;
            cd.hydrate(_DEFAULT_CONTEXT, null, directives, null);
            cd.mode = ChangeDetectionStrategy.Checked;

            cd.handleEvent("event", 0, null);

            expect(cd.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
          });

          it('should mark OnPush detectors as CheckOnce after a host event', () => {
            var cd = _createWithoutHydrate('onPushWithHostEvent').changeDetector;
            cd.hydrate(_DEFAULT_CONTEXT, null, directives, null);

            cd.handleEvent("host-event", 0, null);

            expect(childDirectiveDetectorOnPush.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
          });

          if (IS_DART) {
            describe('OnPushObserve', () => {
              it('should mark OnPushObserve detectors as CheckOnce when an observable fires an event',
                 fakeAsync(() => {
                   var context = new TestDirective();
                   context.a = createObservableModel();

                   var cd = _createWithoutHydrate('onPushObserveBinding').changeDetector;
                   cd.hydrate(context, null, directives, null);
                   cd.detectChanges();

                   expect(cd.mode).toEqual(ChangeDetectionStrategy.Checked);

                   context.a.pushUpdate();
                   tick();

                   expect(cd.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
                 }));

              it('should mark OnPushObserve detectors as CheckOnce when an observable context fires an event',
                 fakeAsync(() => {
                   var context = createObservableModel();

                   var cd = _createWithoutHydrate('onPushObserveComponent').changeDetector;
                   cd.hydrate(context, null, directives, null);
                   cd.detectChanges();

                   expect(cd.mode).toEqual(ChangeDetectionStrategy.Checked);

                   context.pushUpdate();
                   tick();

                   expect(cd.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
                 }));

              it('should mark OnPushObserve detectors as CheckOnce when an observable directive fires an event',
                 fakeAsync(() => {
                   var dir = createObservableModel();
                   var directives = new TestDispatcher([dir], []);

                   var cd = _createWithoutHydrate('onPushObserveDirective').changeDetector;
                   cd.hydrate(_DEFAULT_CONTEXT, null, directives, null);
                   cd.detectChanges();

                   expect(cd.mode).toEqual(ChangeDetectionStrategy.Checked);

                   dir.pushUpdate();
                   tick();

                   expect(cd.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
                 }));

              it('should unsubscribe from an old observable when an object changes',
                 fakeAsync(() => {
                   var originalModel = createObservableModel();
                   var context = new TestDirective();
                   context.a = originalModel;

                   var cd = _createWithoutHydrate('onPushObserveBinding').changeDetector;
                   cd.hydrate(context, null, directives, null);
                   cd.detectChanges();

                   context.a = createObservableModel();
                   cd.mode = ChangeDetectionStrategy.CheckOnce;
                   cd.detectChanges();

                   // Updating this model will not reenable the detector. This model is not longer
                   // used.
                   originalModel.pushUpdate();
                   tick();
                   expect(cd.mode).toEqual(ChangeDetectionStrategy.Checked);
                 }));

              it('should unsubscribe from observables when dehydrating', fakeAsync(() => {
                   var originalModel = createObservableModel();
                   var context = new TestDirective();
                   context.a = originalModel;

                   var cd = _createWithoutHydrate('onPushObserveBinding').changeDetector;
                   cd.hydrate(context, null, directives, null);
                   cd.detectChanges();

                   cd.dehydrate();

                   context.a = "not an observable model";
                   cd.hydrate(context, null, directives, null);
                   cd.detectChanges();

                   // Updating this model will not reenable the detector. This model is not longer
                   // used.
                   originalModel.pushUpdate();
                   tick();
                   expect(cd.mode).toEqual(ChangeDetectionStrategy.Checked);
                 }));
            });
          }
        });
      });

      describe('markPathToRootAsCheckOnce', () => {
        function changeDetector(mode, parent) {
          var val = _createChangeDetector('10');
          val.changeDetector.mode = mode;
          if (isPresent(parent)) parent.addContentChild(val.changeDetector);
          return val.changeDetector;
        }

        it('should mark all checked detectors as CheckOnce until reaching a detached one', () => {
          var root = changeDetector(ChangeDetectionStrategy.CheckAlways, null);
          var disabled = changeDetector(ChangeDetectionStrategy.Detached, root);
          var parent = changeDetector(ChangeDetectionStrategy.Checked, disabled);
          var checkAlwaysChild = changeDetector(ChangeDetectionStrategy.CheckAlways, parent);
          var checkOnceChild = changeDetector(ChangeDetectionStrategy.CheckOnce, checkAlwaysChild);
          var checkedChild = changeDetector(ChangeDetectionStrategy.Checked, checkOnceChild);

          checkedChild.markPathToRootAsCheckOnce();

          expect(root.mode).toEqual(ChangeDetectionStrategy.CheckAlways);
          expect(disabled.mode).toEqual(ChangeDetectionStrategy.Detached);
          expect(parent.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
          expect(checkAlwaysChild.mode).toEqual(ChangeDetectionStrategy.CheckAlways);
          expect(checkOnceChild.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
          expect(checkedChild.mode).toEqual(ChangeDetectionStrategy.CheckOnce);
        });
      });

      describe('hydration', () => {
        it('should be able to rehydrate a change detector', () => {
          var cd = _createChangeDetector('name').changeDetector;

          cd.hydrate('some context', null, null, null);
          expect(cd.hydrated()).toBe(true);

          cd.dehydrate();
          expect(cd.hydrated()).toBe(false);

          cd.hydrate('other context', null, null, null);
          expect(cd.hydrated()).toBe(true);
        });

        it('should destroy all active pipes implementing ngOnDestroy during dehyration', () => {
          var pipe = new PipeWithOnDestroy();
          var registry = new FakePipes('pipe', () => pipe);
          var cd = _createChangeDetector('name | pipe', new Person('bob'), registry).changeDetector;

          cd.detectChanges();
          cd.dehydrate();

          expect(pipe.destroyCalled).toBe(true);
        });

        it('should not call ngOnDestroy all pipes that do not implement ngOnDestroy', () => {
          var pipe = new CountingPipe();
          var registry = new FakePipes('pipe', () => pipe);
          var cd = _createChangeDetector('name | pipe', new Person('bob'), registry).changeDetector;

          cd.detectChanges();
          expect(() => cd.dehydrate()).not.toThrow();
        });

        it('should throw when detectChanges is called on a dehydrated detector', () => {
          var context = new Person('Bob');
          var val = _createChangeDetector('name', context);

          val.changeDetector.detectChanges();
          expect(val.dispatcher.log).toEqual(['propName=Bob']);

          val.changeDetector.dehydrate();
          expect(() => {val.changeDetector.detectChanges()})
              .toThrowErrorWith("Attempt to use a dehydrated detector");
          expect(val.dispatcher.log).toEqual(['propName=Bob']);
        });
      });

      it('should do nothing when no change', () => {
        var registry = new FakePipes('pipe', () => new IdentityPipe());
        var ctx = new Person('Megatron');

        var val = _createChangeDetector('name | pipe', ctx, registry);

        val.changeDetector.detectChanges();

        expect(val.dispatcher.log).toEqual(['propName=Megatron']);

        val.dispatcher.clear();
        val.changeDetector.detectChanges();

        expect(val.dispatcher.log).toEqual([]);
      });

      it('should unwrap the wrapped value', () => {
        var registry = new FakePipes('pipe', () => new WrappedPipe());
        var ctx = new Person('Megatron');

        var val = _createChangeDetector('name | pipe', ctx, registry);

        val.changeDetector.detectChanges();

        expect(val.dispatcher.log).toEqual(['propName=Megatron']);
      });

      describe('handleEvent', () => {
        var event;
        var d: TestDirective;

        beforeEach(() => {
          event = "EVENT";
          d = new TestDirective();
        });

        it('should execute events', () => {
          var val = _createChangeDetector('(event)="onEvent($event)"', d, null);
          val.changeDetector.handleEvent("event", 0, event);
          expect(d.event).toEqual("EVENT");
        });

        it('should execute host events', () => {
          var val = _createWithoutHydrate('(host-event)="onEvent($event)"');
          val.changeDetector.hydrate(_DEFAULT_CONTEXT, null,
                                     new TestDispatcher([d, new TestDirective()], []), null);
          val.changeDetector.handleEvent("host-event", 0, event);
          expect(d.event).toEqual("EVENT");
        });

        it('should support field assignments', () => {
          var val = _createChangeDetector('(event)="b=a=$event"', d, null);
          val.changeDetector.handleEvent("event", 0, event);
          expect(d.a).toEqual("EVENT");
          expect(d.b).toEqual("EVENT");
        });

        it('should support keyed assignments', () => {
          d.a = ["OLD"];
          var val = _createChangeDetector('(event)="a[0]=$event"', d, null);
          val.changeDetector.handleEvent("event", 0, event);
          expect(d.a).toEqual(["EVENT"]);
        });

        it('should support chains', () => {
          d.a = 0;
          var val = _createChangeDetector('(event)="a=a+1; a=a+1;"', d, null);
          val.changeDetector.handleEvent("event", 0, event);
          expect(d.a).toEqual(2);
        });

        // TODO: enable after chaining dart infrastructure for generating tests
        // it('should throw when trying to assign to a local', () => {
        //   expect(() => {
        //     _createChangeDetector('(event)="$event=1"', d, null)
        //   }).toThrowError(new RegExp("Cannot reassign a variable binding"));
        // });

        it('should return false if the event handler returned false', () => {
          var val = _createChangeDetector('(event)="false"', d, null);
          var res = val.changeDetector.handleEvent("event", 0, event);
          expect(res).toBe(false);

          val = _createChangeDetector('(event)="true"', d, null);
          res = val.changeDetector.handleEvent("event", 0, event);
          expect(res).toBe(true);

          val = _createChangeDetector('(event)="true; false"', d, null);
          res = val.changeDetector.handleEvent("event", 0, event);
          expect(res).toBe(false);
        });

        it('should support short-circuiting', () => {
          d.a = 0;
          var val = _createChangeDetector('(event)="true ? a = a + 1 : a = a + 1"', d, null);
          val.changeDetector.handleEvent("event", 0, event);
          expect(d.a).toEqual(1);
        });
      });

      if (DOM.supportsDOMEvents()) {
        describe('subscribe to EventEmitters', () => {
          it('should call handleEvent when an output of a directive fires', fakeAsync(() => {
               var directive1 = new TestDirective();
               var directive2 = new TestDirective();
               _createChangeDetector('(host-event)="onEvent(\$event)"', new Object(), null,
                                     new TestDispatcher([directive1, directive2]));
               ObservableWrapper.callEmit(directive2.eventEmitter, 'EVENT');

               tick();

               expect(directive1.event).toEqual('EVENT');
             }));

          it('should ignore events when dehydrated', fakeAsync(() => {
               var directive1 = new TestDirective();
               var directive2 = new TestDirective();
               var cd = _createChangeDetector('(host-event)="onEvent(\$event)"', new Object(), null,
                                              new TestDispatcher([directive1, directive2]))
                            .changeDetector;
               cd.dehydrate();
               ObservableWrapper.callEmit(directive2.eventEmitter, 'EVENT');

               tick();

               expect(directive1.event).toBeFalsy();
             }));
        });
      }

      describe('destroyRecursive', () => {
        var parent, child;
        var parentDispatcher, childDispatcher;

        beforeEach(() => {
          parentDispatcher = new TestDispatcher();
          parent = _createChangeDetector('10', null, null, parentDispatcher).changeDetector;
          childDispatcher = new TestDispatcher();
          child = _createChangeDetector('"str"', null, null, childDispatcher).changeDetector;
          parent.addContentChild(child);
        });

        it('should notify the dispatcher', () => {
          child.destroyRecursive();
          expect(childDispatcher.ngOnDestroyCalled).toBe(true);
        });

        it('should dehydrate the change detector', () => {
          child.destroyRecursive();
          expect(child.hydrated()).toBe(false);
        });

        it('should destroy children', () => {
          parent.destroyRecursive();
          expect(parentDispatcher.ngOnDestroyCalled).toBe(true);
          expect(childDispatcher.ngOnDestroyCalled).toBe(true);
        });

      });
    });
  });
}

class CountingPipe implements PipeTransform {
  state: number = 0;
  transform(value, args = null) { return `${value} state:${this.state ++}`; }
}

class PipeWithOnDestroy implements PipeTransform, OnDestroy {
  destroyCalled: boolean = false;
  ngOnDestroy() { this.destroyCalled = true; }

  transform(value, args = null) { return null; }
}

class IdentityPipe implements PipeTransform {
  transform(value, args = null) { return value; }
}

class WrappedPipe implements PipeTransform {
  transform(value, args = null) { return WrappedValue.wrap(value); }
}

class MultiArgPipe implements PipeTransform {
  transform(value, args = null) {
    var arg1 = args[0];
    var arg2 = args[1];
    var arg3 = args.length > 2 ? args[2] : 'default';
    return `${value} ${arg1} ${arg2} ${arg3}`;
  }
}

class FakePipes implements Pipes {
  numberOfLookups = 0;
  pure: boolean;

  constructor(public pipeType: string, public factory: Function, {pure}: {pure?: boolean} = {}) {
    this.pure = normalizeBool(pure);
  }

  get(type: string) {
    if (type != this.pipeType) return null;
    this.numberOfLookups++;
    return new SelectedPipe(this.factory(), this.pure);
  }
}

class TestDirective {
  a;
  b;
  changes;
  ngDoCheckCalled = false;
  ngOnInitCalled = false;

  ngAfterContentInitCalled = false;
  ngAfterContentCheckedCalled = false;

  ngAfterViewInitCalled = false;
  ngAfterViewCheckedCalled = false;
  destroyCalled: boolean = false;
  event;
  eventEmitter: EventEmitter<string> = new EventEmitter<string>();

  constructor(public ngAfterContentCheckedSpy = null, public ngAfterViewCheckedSpy = null,
              public throwOnInit = false) {}

  onEvent(event) { this.event = event; }

  ngDoCheck() { this.ngDoCheckCalled = true; }

  ngOnInit() {
    this.ngOnInitCalled = true;
    if (this.throwOnInit) {
      throw "simulated ngOnInit failure";
    }
  }

  ngOnChanges(changes) {
    var r = {};
    StringMapWrapper.forEach(changes, (c, key) => r[key] = c.currentValue);
    this.changes = r;
  }

  ngAfterContentInit() { this.ngAfterContentInitCalled = true; }

  ngAfterContentChecked() {
    this.ngAfterContentCheckedCalled = true;
    if (isPresent(this.ngAfterContentCheckedSpy)) {
      this.ngAfterContentCheckedSpy();
    }
  }

  ngAfterViewInit() { this.ngAfterViewInitCalled = true; }

  ngAfterViewChecked() {
    this.ngAfterViewCheckedCalled = true;
    if (isPresent(this.ngAfterViewCheckedSpy)) {
      this.ngAfterViewCheckedSpy();
    }
  }

  ngOnDestroy() { this.destroyCalled = true; }
}

class Person {
  age: number;
  constructor(public name: string, public address: Address = null) {}

  sayHi(m) { return `Hi, ${m}`; }

  passThrough(val) { return val; }

  toString(): string {
    var address = this.address == null ? '' : ' address=' + this.address.toString();

    return 'name=' + this.name + address;
  }
}

class Address {
  cityGetterCalls: number = 0;
  zipCodeGetterCalls: number = 0;

  constructor(public _city: string, public _zipcode = null) {}

  get city() {
    this.cityGetterCalls++;
    return this._city;
  }

  get zipcode() {
    this.zipCodeGetterCalls++;
    return this._zipcode;
  }

  set city(v) { this._city = v; }

  set zipcode(v) { this._zipcode = v; }

  toString(): string { return isBlank(this.city) ? '-' : this.city }
}

class Logical {
  trueCalls: number = 0;
  falseCalls: number = 0;

  getTrue() {
    this.trueCalls++;
    return true;
  }

  getFalse() {
    this.falseCalls++;
    return false;
  }
}

class Uninitialized {
  value: any;
}

class TestData {
  constructor(public a: any) {}
}

class TestDataWithGetter {
  constructor(private fn: Function) {}

  get a() { return this.fn(); }
}

class TestDispatcher implements ChangeDispatcher {
  log: string[];
  debugLog: string[];
  loggedValues: any[];
  ngAfterContentCheckedCalled: boolean = false;
  ngAfterViewCheckedCalled: boolean = false;
  ngOnDestroyCalled: boolean = false;

  constructor(public directives: Array<TestData | TestDirective> = null,
              public detectors: any[] = null) {
    if (isBlank(this.directives)) {
      this.directives = [];
    }
    if (isBlank(this.detectors)) {
      this.detectors = [];
    }
    this.clear();
  }

  clear() {
    this.log = [];
    this.debugLog = [];
    this.loggedValues = [];
    this.ngAfterContentCheckedCalled = true;
  }

  getDirectiveFor(di: DirectiveIndex) { return this.directives[di.directiveIndex]; }

  getDetectorFor(di: DirectiveIndex) { return this.detectors[di.directiveIndex]; }

  notifyOnBinding(target, value) {
    this.log.push(`${target.name}=${this._asString(value)}`);
    this.loggedValues.push(value);
  }

  logBindingUpdate(target, value) { this.debugLog.push(`${target.name}=${this._asString(value)}`); }

  notifyAfterContentChecked() { this.ngAfterContentCheckedCalled = true; }
  notifyAfterViewChecked() { this.ngAfterViewCheckedCalled = true; }

  notifyOnDestroy() { this.ngOnDestroyCalled = true; }

  getDebugContext(a, b, c) { return null; }

  _asString(value) {
    if (isNumber(value) && NumberWrapper.isNaN(value)) {
      return 'NaN';
    }

    return isBlank(value) ? 'null' : value.toString();
  }
}

class _ChangeDetectorAndDispatcher {
  constructor(public changeDetector: any, public dispatcher: any) {}
}
