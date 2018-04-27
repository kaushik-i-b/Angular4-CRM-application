import {provide, Provider, Component, View} from 'angular2/core';
import {Type, isBlank} from 'angular2/src/facade/lang';
import {BaseException} from 'angular2/src/facade/exceptions';

import {
  ComponentFixture,
  AsyncTestCompleter,
  TestComponentBuilder,
  beforeEach,
  ddescribe,
  xdescribe,
  describe,
  el,
  inject,
  beforeEachProviders,
  it,
  xit
} from 'angular2/testing_internal';

import {RootRouter} from 'angular2/src/router/router';
import {Router, ROUTER_DIRECTIVES, ROUTER_PRIMARY_COMPONENT} from 'angular2/router';

import {SpyLocation} from 'angular2/src/mock/location_mock';
import {Location} from 'angular2/src/router/location';
import {RouteRegistry} from 'angular2/src/router/route_registry';
import {DirectiveResolver} from 'angular2/src/core/linker/directive_resolver';
import {DOM} from 'angular2/src/platform/dom/dom_adapter';
export {ComponentFixture} from 'angular2/testing_internal';


/**
 * Router test helpers and fixtures
 */

@Component({
  selector: 'root-comp',
  template: `<router-outlet></router-outlet>`,
  directives: [ROUTER_DIRECTIVES]
})
export class RootCmp {
  name: string;
}

export function compile(tcb: TestComponentBuilder,
                        template: string = "<router-outlet></router-outlet>") {
  return tcb.overrideTemplate(RootCmp, ('<div>' + template + '</div>')).createAsync(RootCmp);
}

export var TEST_ROUTER_PROVIDERS = [
  RouteRegistry,
  DirectiveResolver,
  provide(Location, {useClass: SpyLocation}),
  provide(ROUTER_PRIMARY_COMPONENT, {useValue: RootCmp}),
  provide(Router, {useClass: RootRouter})
];

export function clickOnElement(anchorEl) {
  var dispatchedEvent = DOM.createMouseEvent('click');
  DOM.dispatchEvent(anchorEl, dispatchedEvent);
  return dispatchedEvent;
}

export function getHref(elt) {
  return DOM.getAttribute(elt, 'href');
}


/**
 * Router integration suite DSL
 */

var specNameBuilder = [];

// we add the specs themselves onto this map
export var specs = {};

export function describeRouter(description: string, fn: Function, exclusive = false): void {
  var specName = descriptionToSpecName(description);
  specNameBuilder.push(specName);
  if (exclusive) {
    ddescribe(description, fn);
  } else {
    describe(description, fn);
  }
  specNameBuilder.pop();
}

export function ddescribeRouter(description: string, fn: Function, exclusive = false): void {
  describeRouter(description, fn, true);
}

export function describeWithAndWithout(description: string, fn: Function): void {
  // the "without" case is usually simpler, so we opt to run this spec first
  describeWithout(description, fn);
  describeWith(description, fn);
}

export function describeWith(description: string, fn: Function): void {
  var specName = 'with ' + description;
  specNameBuilder.push(specName);
  describe(specName, fn);
  specNameBuilder.pop();
}

export function describeWithout(description: string, fn: Function): void {
  var specName = 'without ' + description;
  specNameBuilder.push(specName);
  describe(specName, fn);
  specNameBuilder.pop();
}

function descriptionToSpecName(description: string): string {
  return spaceCaseToCamelCase(description);
}

// this helper looks up the suite registered from the "impl" folder in this directory
export function itShouldRoute() {
  var specSuiteName = spaceCaseToCamelCase(specNameBuilder.join(' '));

  var spec = specs[specSuiteName];
  if (isBlank(spec)) {
    throw new BaseException(`Router integration spec suite "${specSuiteName}" was not found.`);
  } else {
    // todo: remove spec from map, throw if there are extra left over??
    spec();
  }
}

function spaceCaseToCamelCase(str: string): string {
  var words = str.split(' ');
  var first = words.shift();
  return first + words.map(title).join('');
}

function title(str: string): string {
  return str[0].toUpperCase() + str.substring(1);
}
