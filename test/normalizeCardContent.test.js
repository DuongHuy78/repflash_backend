import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCardContent,
} from '../src/utils/utlils.js';

test('chuẩn hóa nội dung khi tạo card', () => {
    // Arrange: chuẩn bị dữ liệu
    const input = {
        front: '  hello  ',
        pronunciation: '  həˈloʊ  ',
        speechText: '  hello  ',
        back: '  xin chào  ',
        examples: [
            {
                text: '  Hello, everyone!  ',
                translation: '  Xin chào mọi người!  ',
                ttsText: '  Hello everyone  ',
            },
        ],
    };

    // Act: gọi hàm cần test
    const result = normalizeCardContent(input);

    // Assert: so sánh kết quả
    assert.deepEqual(result, {
        front: 'hello',
        pronunciation: 'həˈloʊ',
        speechText: 'hello',
        back: 'xin chào',
        examples: [
            {
                text: 'Hello, everyone!',
                translation: 'Xin chào mọi người!',
                ttsText: 'Hello everyone',
            },
        ],
    });
});

test('partial edit không tự tạo examples khi request không gửi examples',() => {
    const input = {
      front: 'Nội dung mới',
    };

    const result = normalizeCardContent(
      input,
      { partial: true },
    );

    assert.deepEqual(result, {
      front: 'Nội dung mới',
    });

    assert.equal(
      Object.hasOwn(result, 'examples'),
      false,
    );
  },
);

test('tạo card phải có front', () => {
  assert.throws(
    () => {
      normalizeCardContent({
        back: 'Nghĩa',
        examples: [],
      });
    },
    /Mặt trước/,
  );
});

test('examples phải là một mảng', () => {
  assert.throws(
    () => {
      normalizeCardContent({
        front: 'hello',
        back: 'xin chào',
        examples: 'không phải mảng',
      });
    },
    /Danh sách ví dụ phải là một mảng/,
  );
});

test('mỗi example phải có text', () => {
  assert.throws(
    () => {
      normalizeCardContent({
        front: 'hello',
        back: 'xin chào',
        examples: [
          {
            translation: 'Xin chào',
          },
        ],
      });
    },
    /Nội dung ví dụ số 1/,
  );
});