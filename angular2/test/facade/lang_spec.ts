import {describe, it, expect, beforeEach, ddescribe, iit, xit, el} from 'angular2/testing_internal';
import {
  isPresent,
  RegExpWrapper,
  RegExpMatcherWrapper,
  StringWrapper,
  CONST_EXPR
} from 'angular2/src/facade/lang';

export function main() {
  describe('RegExp', () => {
    it('should expose the index for each match', () => {
      var re = /(!)/g;
      var matcher = RegExpWrapper.matcher(re, '0!23!567!!');
      var indexes = [];
      var m;

      while (isPresent(m = RegExpMatcherWrapper.next(matcher))) {
        indexes.push(m.index);
        expect(m[0]).toEqual('!');
        expect(m[1]).toEqual('!');
        expect(m.length).toBe(2);
      }

      expect(indexes).toEqual([1, 4, 8, 9]);
    });

    it('should reset before it is reused', () => {
      var re = /^['"]/g;
      var str = "'";
      expect(RegExpWrapper.test(re, str)).toEqual(true);
      // If not reset, the second attempt to test results in false
      expect(RegExpWrapper.test(re, str)).toEqual(true);
    });
  });

  describe('const', () => {
    it('should support const expressions both in TS and Dart', () => {
      const numbers = CONST_EXPR([1, 2, 3]);
      expect(numbers).toEqual([1, 2, 3]);
    });
  });

  describe('String', () => {
    var s;

    describe('slice', () => {
      beforeEach(() => { s = "abcdefghij"; });

      it('should return the whole string if neither start nor end are specified',
         () => { expect(StringWrapper.slice(s)).toEqual("abcdefghij"); });

      it('should return up to the end if end is not specified',
         () => { expect(StringWrapper.slice(s, 1)).toEqual("bcdefghij"); });

      it('should support negative start',
         () => { expect(StringWrapper.slice(s, -1)).toEqual("j"); });

      it('should support negative end',
         () => { expect(StringWrapper.slice(s, -3, -1)).toEqual("hi"); });

      it('should return empty string if start is greater than end', () => {
        expect(StringWrapper.slice(s, 4, 2)).toEqual("");
        expect(StringWrapper.slice(s, -2, -4)).toEqual("");
      });
    });

    describe('stripLeft', () => {
      it('should strip the first character of the string if it matches the provided input', () => {
        var input = "~angular2 is amazing";
        var expectedOutput = "angular2 is amazing";

        expect(StringWrapper.stripLeft(input, "~")).toEqual(expectedOutput);
      });

      it('should keep stripping characters from the start until the first unmatched character',
         () => {
           var input = "#####hello";
           var expectedOutput = "hello";
           expect(StringWrapper.stripLeft(input, "#")).toEqual(expectedOutput);
         });

      it('should not alter the provided input if the first character does not match the provided input',
         () => {
           var input = "+angular2 is amazing";
           expect(StringWrapper.stripLeft(input, "*")).toEqual(input);
         });

      it('should not do any alterations when an empty string or null value is passed in', () => {
        expect(StringWrapper.stripLeft("", "S")).toEqual("");
        expect(StringWrapper.stripLeft(null, "S")).toEqual(null);
      });
    });

    describe('stripRight', () => {
      it('should strip the first character of the string if it matches the provided input', () => {
        var input = "angular2 is amazing!";
        var expectedOutput = "angular2 is amazing";

        expect(StringWrapper.stripRight(input, "!")).toEqual(expectedOutput);
      });

      it('should not alter the provided input if the first character does not match the provided input',
         () => {
           var input = "angular2 is amazing+";

           expect(StringWrapper.stripRight(input, "*")).toEqual(input);
         });

      it('should keep stripping characters from the end until the first unmatched character',
         () => {
           var input = "hi&!&&&&&";
           var expectedOutput = "hi&!";
           expect(StringWrapper.stripRight(input, "&")).toEqual(expectedOutput);
         });

      it('should not do any alterations when an empty string or null value is passed in', () => {
        expect(StringWrapper.stripRight("", "S")).toEqual("");
        expect(StringWrapper.stripRight(null, "S")).toEqual(null);
      });
    });
  });
}
