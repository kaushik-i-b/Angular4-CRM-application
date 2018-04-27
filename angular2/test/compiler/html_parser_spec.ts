import {
  ddescribe,
  describe,
  it,
  iit,
  xit,
  expect,
  beforeEach,
  afterEach
} from 'angular2/testing_internal';

import {HtmlTokenType} from 'angular2/src/compiler/html_lexer';
import {HtmlParser, HtmlParseTreeResult, HtmlTreeError} from 'angular2/src/compiler/html_parser';
import {
  HtmlAst,
  HtmlAstVisitor,
  HtmlElementAst,
  HtmlAttrAst,
  HtmlTextAst,
  htmlVisitAll
} from 'angular2/src/compiler/html_ast';
import {ParseError, ParseLocation, ParseSourceSpan} from 'angular2/src/compiler/parse_util';

import {BaseException} from 'angular2/src/facade/exceptions';

export function main() {
  describe('HtmlParser', () => {
    var parser: HtmlParser;
    beforeEach(() => { parser = new HtmlParser(); });

    describe('parse', () => {
      describe('text nodes', () => {
        it('should parse root level text nodes', () => {
          expect(humanizeDom(parser.parse('a', 'TestComp'))).toEqual([[HtmlTextAst, 'a', 0]]);
        });

        it('should parse text nodes inside regular elements', () => {
          expect(humanizeDom(parser.parse('<div>a</div>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'div', 0], [HtmlTextAst, 'a', 1]]);
        });

        it('should parse text nodes inside template elements', () => {
          expect(humanizeDom(parser.parse('<template>a</template>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'template', 0], [HtmlTextAst, 'a', 1]]);
        });

        it('should parse CDATA', () => {
          expect(humanizeDom(parser.parse('<![CDATA[text]]>', 'TestComp')))
              .toEqual([[HtmlTextAst, 'text', 0]]);
        });
      });

      describe('elements', () => {
        it('should parse root level elements', () => {
          expect(humanizeDom(parser.parse('<div></div>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'div', 0]]);
        });

        it('should parse elements inside of regular elements', () => {
          expect(humanizeDom(parser.parse('<div><span></span></div>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'div', 0], [HtmlElementAst, 'span', 1]]);
        });

        it('should parse elements inside of template elements', () => {
          expect(humanizeDom(parser.parse('<template><span></span></template>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'template', 0], [HtmlElementAst, 'span', 1]]);
        });

        it('should support void elements', () => {
          expect(humanizeDom(parser.parse('<link rel="author license" href="/about">', 'TestComp')))
              .toEqual([
                [HtmlElementAst, 'link', 0],
                [HtmlAttrAst, 'rel', 'author license'],
                [HtmlAttrAst, 'href', '/about'],
              ]);
        });

        it('should not error on void elements from HTML5 spec',
           () => {  // http://www.w3.org/TR/html-markup/syntax.html#syntax-elements without:
             // <base> - it can be present in head only
             // <meta> - it can be present in head only
             // <command> - obsolete
             // <keygen> - obsolete
             ['<map><area></map>', '<div><br></div>', '<colgroup><col></colgroup>',
              '<div><embed></div>', '<div><hr></div>', '<div><img></div>', '<div><input></div>',
              '<object><param>/<object>', '<audio><source></audio>', '<audio><track></audio>',
              '<p><wbr></p>',
             ].forEach((html) => { expect(parser.parse(html, 'TestComp').errors).toEqual([]); });
           });

        it('should close void elements on text nodes', () => {
          expect(humanizeDom(parser.parse('<p>before<br>after</p>', 'TestComp')))
              .toEqual([
                [HtmlElementAst, 'p', 0],
                [HtmlTextAst, 'before', 1],
                [HtmlElementAst, 'br', 1],
                [HtmlTextAst, 'after', 1],
              ]);
        });

        it('should support optional end tags', () => {
          expect(humanizeDom(parser.parse('<div><p>1<p>2</div>', 'TestComp')))
              .toEqual([
                [HtmlElementAst, 'div', 0],
                [HtmlElementAst, 'p', 1],
                [HtmlTextAst, '1', 2],
                [HtmlElementAst, 'p', 1],
                [HtmlTextAst, '2', 2],
              ]);
        });

        it('should support nested elements', () => {
          expect(humanizeDom(parser.parse('<ul><li><ul><li></li></ul></li></ul>', 'TestComp')))
              .toEqual([
                [HtmlElementAst, 'ul', 0],
                [HtmlElementAst, 'li', 1],
                [HtmlElementAst, 'ul', 2],
                [HtmlElementAst, 'li', 3],
              ]);
        });

        it('should add the requiredParent', () => {
          expect(
              humanizeDom(parser.parse(
                  '<table><thead><tr head></tr></thead><tr noparent></tr><tbody><tr body></tr></tbody><tfoot><tr foot></tr></tfoot></table>',
                  'TestComp')))
              .toEqual([
                [HtmlElementAst, 'table', 0],
                [HtmlElementAst, 'thead', 1],
                [HtmlElementAst, 'tr', 2],
                [HtmlAttrAst, 'head', ''],
                [HtmlElementAst, 'tbody', 1],
                [HtmlElementAst, 'tr', 2],
                [HtmlAttrAst, 'noparent', ''],
                [HtmlElementAst, 'tbody', 1],
                [HtmlElementAst, 'tr', 2],
                [HtmlAttrAst, 'body', ''],
                [HtmlElementAst, 'tfoot', 1],
                [HtmlElementAst, 'tr', 2],
                [HtmlAttrAst, 'foot', '']
              ]);
        });

        it('should not add the requiredParent when the parent is a template', () => {
          expect(humanizeDom(parser.parse('<template><tr></tr></template>', 'TestComp')))
              .toEqual([
                [HtmlElementAst, 'template', 0],
                [HtmlElementAst, 'tr', 1],
              ]);
        });

        it('should support explicit mamespace', () => {
          expect(humanizeDom(parser.parse('<myns:div></myns:div>', 'TestComp')))
              .toEqual([[HtmlElementAst, '@myns:div', 0]]);
        });

        it('should support implicit mamespace', () => {
          expect(humanizeDom(parser.parse('<svg></svg>', 'TestComp')))
              .toEqual([[HtmlElementAst, '@svg:svg', 0]]);
        });

        it('should propagate the namespace', () => {
          expect(humanizeDom(parser.parse('<myns:div><p></p></myns:div>', 'TestComp')))
              .toEqual([[HtmlElementAst, '@myns:div', 0], [HtmlElementAst, '@myns:p', 1]]);
        });

        it('should match closing tags case sensitive', () => {
          let errors = parser.parse('<DiV><P></p></dIv>', 'TestComp').errors;
          expect(errors.length).toEqual(2);
          expect(humanizeErrors(errors))
              .toEqual([
                ['p', 'Unexpected closing tag "p"', '0:8'],
                ['dIv', 'Unexpected closing tag "dIv"', '0:12'],
              ]);
        });

        it('should support self closing void elements', () => {
          expect(humanizeDom(parser.parse('<input />', 'TestComp')))
              .toEqual([[HtmlElementAst, 'input', 0]]);
        });

        it('should support self closing foreign elements', () => {
          expect(humanizeDom(parser.parse('<math />', 'TestComp')))
              .toEqual([[HtmlElementAst, '@math:math', 0]]);
        });

        it('should ignore LF immediately after textarea, pre and listing', () => {
          expect(humanizeDom(parser.parse(
                     '<p>\n</p><textarea>\n</textarea><pre>\n\n</pre><listing>\n\n</listing>',
                     'TestComp')))
              .toEqual([
                [HtmlElementAst, 'p', 0],
                [HtmlTextAst, '\n', 1],
                [HtmlElementAst, 'textarea', 0],
                [HtmlElementAst, 'pre', 0],
                [HtmlTextAst, '\n', 1],
                [HtmlElementAst, 'listing', 0],
                [HtmlTextAst, '\n', 1],
              ]);
        });

      });

      describe('attributes', () => {
        it('should parse attributes on regular elements case sensitive', () => {
          expect(humanizeDom(parser.parse('<div kEy="v" key2=v2></div>', 'TestComp')))
              .toEqual([
                [HtmlElementAst, 'div', 0],
                [HtmlAttrAst, 'kEy', 'v'],
                [HtmlAttrAst, 'key2', 'v2'],
              ]);
        });

        it('should parse attributes without values', () => {
          expect(humanizeDom(parser.parse('<div k></div>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'div', 0], [HtmlAttrAst, 'k', '']]);
        });

        it('should parse attributes on svg elements case sensitive', () => {
          expect(humanizeDom(parser.parse('<svg viewBox="0"></svg>', 'TestComp')))
              .toEqual([[HtmlElementAst, '@svg:svg', 0], [HtmlAttrAst, 'viewBox', '0']]);
        });

        it('should parse attributes on template elements', () => {
          expect(humanizeDom(parser.parse('<template k="v"></template>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'template', 0], [HtmlAttrAst, 'k', 'v']]);
        });

        it('should support mamespace', () => {
          expect(humanizeDom(parser.parse('<svg:use xlink:href="Port" />', 'TestComp')))
              .toEqual([[HtmlElementAst, '@svg:use', 0], [HtmlAttrAst, '@xlink:href', 'Port']]);
        });
      });

      describe('comments', () => {
        it('should ignore comments', () => {
          expect(humanizeDom(parser.parse('<!-- comment --><div></div>', 'TestComp')))
              .toEqual([[HtmlElementAst, 'div', 0]]);
        });
      });

      describe('source spans', () => {
        it('should store the location', () => {
          expect(humanizeDomSourceSpans(parser.parse(
                     '<div [prop]="v1" (e)="do()" attr="v2" noValue>\na\n</div>', 'TestComp')))
              .toEqual([
                [HtmlElementAst, 'div', 0, '<div [prop]="v1" (e)="do()" attr="v2" noValue>'],
                [HtmlAttrAst, '[prop]', 'v1', '[prop]="v1"'],
                [HtmlAttrAst, '(e)', 'do()', '(e)="do()"'],
                [HtmlAttrAst, 'attr', 'v2', 'attr="v2"'],
                [HtmlAttrAst, 'noValue', '', 'noValue'],
                [HtmlTextAst, '\na\n', 1, '\na\n'],
              ]);
        });
      });

      describe('errors', () => {
        it('should report unexpected closing tags', () => {
          let errors = parser.parse('<div></p></div>', 'TestComp').errors;
          expect(errors.length).toEqual(1);
          expect(humanizeErrors(errors)).toEqual([['p', 'Unexpected closing tag "p"', '0:5']]);
        });

        it('should report closing tag for void elements', () => {
          let errors = parser.parse('<input></input>', 'TestComp').errors;
          expect(errors.length).toEqual(1);
          expect(humanizeErrors(errors))
              .toEqual([['input', 'Void elements do not have end tags "input"', '0:7']]);
        });

        it('should report self closing html element', () => {
          let errors = parser.parse('<p />', 'TestComp').errors;
          expect(errors.length).toEqual(1);
          expect(humanizeErrors(errors))
              .toEqual([['p', 'Only void and foreign elements can be self closed "p"', '0:0']]);
        });

        it('should report self closing custom element', () => {
          let errors = parser.parse('<my-cmp />', 'TestComp').errors;
          expect(errors.length).toEqual(1);
          expect(humanizeErrors(errors))
              .toEqual([
                ['my-cmp', 'Only void and foreign elements can be self closed "my-cmp"', '0:0']
              ]);
        });

        it('should also report lexer errors', () => {
          let errors = parser.parse('<!-err--><div></p></div>', 'TestComp').errors;
          expect(errors.length).toEqual(2);
          expect(humanizeErrors(errors))
              .toEqual([
                [HtmlTokenType.COMMENT_START, 'Unexpected character "e"', '0:3'],
                ['p', 'Unexpected closing tag "p"', '0:14']
              ]);
        });
      });
    });
  });
}

function humanizeDom(parseResult: HtmlParseTreeResult): any[] {
  if (parseResult.errors.length > 0) {
    var errorString = parseResult.errors.join('\n');
    throw new BaseException(`Unexpected parse errors:\n${errorString}`);
  }

  var humanizer = new Humanizer(false);
  htmlVisitAll(humanizer, parseResult.rootNodes);
  return humanizer.result;
}

function humanizeDomSourceSpans(parseResult: HtmlParseTreeResult): any[] {
  if (parseResult.errors.length > 0) {
    var errorString = parseResult.errors.join('\n');
    throw new BaseException(`Unexpected parse errors:\n${errorString}`);
  }

  var humanizer = new Humanizer(true);
  htmlVisitAll(humanizer, parseResult.rootNodes);
  return humanizer.result;
}

function humanizeLineColumn(location: ParseLocation): string {
  return `${location.line}:${location.col}`;
}

function humanizeErrors(errors: ParseError[]): any[] {
  return errors.map(error => {
    if (error instanceof HtmlTreeError) {
      // Parser errors
      return [<any>error.elementName, error.msg, humanizeLineColumn(error.location)];
    }
    // Tokenizer errors
    return [(<any>error).tokenType, error.msg, humanizeLineColumn(error.location)];
  });
}

class Humanizer implements HtmlAstVisitor {
  result: any[] = [];
  elDepth: number = 0;

  constructor(private includeSourceSpan: boolean){};

  visitElement(ast: HtmlElementAst, context: any): any {
    var res = this._appendContext(ast, [HtmlElementAst, ast.name, this.elDepth++]);
    this.result.push(res);
    htmlVisitAll(this, ast.attrs);
    htmlVisitAll(this, ast.children);
    this.elDepth--;
    return null;
  }

  visitAttr(ast: HtmlAttrAst, context: any): any {
    var res = this._appendContext(ast, [HtmlAttrAst, ast.name, ast.value]);
    this.result.push(res);
    return null;
  }

  visitText(ast: HtmlTextAst, context: any): any {
    var res = this._appendContext(ast, [HtmlTextAst, ast.value, this.elDepth]);
    this.result.push(res);
    return null;
  }

  private _appendContext(ast: HtmlAst, input: any[]): any[] {
    if (!this.includeSourceSpan) return input;
    input.push(ast.sourceSpan.toString());
    return input;
  }
}
