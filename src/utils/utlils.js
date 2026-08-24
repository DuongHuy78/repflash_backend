// 1. Chuyển đổi đối tượng Date thành chuỗi "YYYY-MM-DD" theo đúng múi giờ chỉ định
export const getLocalDateString = (date, timeZone = 'Asia/Ho_Chi_Minh') => {
  if (!date) return null;
  // 'en-CA' sẽ xuất ra định dạng chuẩn YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(date));
};

// 2. Tính số ngày chênh lệch giữa 2 chuỗi ngày "YYYY-MM-DD"
export const getDaysDifference = (startDateStr, endDateStr) => {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 3600 * 24));
};

// Lấy các thành phần ngày/giờ khi nhìn một thời điểm theo timezone chỉ định.
const getZonedDateTimeParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(date));

  return Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, Number(value)])
  );
};

// Tính độ lệch giữa UTC và timezone tại đúng thời điểm cần xét.
const getTimeZoneOffsetMilliseconds = (date, timeZone) => {
  const instant = new Date(date);
  const parts = getZonedDateTimeParts(instant, timeZone);
  const localTimeAsUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return localTimeAsUTC - instant.getTime();
};

// Đổi một ngày/giờ theo lịch của user thành thời điểm UTC để query MongoDB.
const zonedDateTimeToUTC = (year, month, day, hour, minute, second, millisecond, timeZone) => {
  const localTime = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let utcTimestamp = localTime;

  // Tính lại offset vì timezone có thể đổi giờ mùa hè (DST) vào ngày khác.
  for (let index = 0; index < 2; index += 1) {
    const offset = getTimeZoneOffsetMilliseconds(utcTimestamp, timeZone);
    utcTimestamp = localTime - offset;
  }

  return new Date(utcTimestamp);
};

// Tạo phạm vi UTC của "hôm nay" theo timezone của user.
export const getDayRangeInTimeZone = (date = new Date(), timeZone = 'Asia/Ho_Chi_Minh') => {
  const now = new Date(date);
  if (Number.isNaN(now.getTime())) {
    throw new Error('Ngày không hợp lệ');
  }

  const today = getZonedDateTimeParts(now, timeZone);
  const tomorrowCalendar = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));

  const startOfDay = zonedDateTimeToUTC(
    today.year,
    today.month,
    today.day,
    0,
    0,
    0,
    0,
    timeZone
  );
  const startOfTomorrow = zonedDateTimeToUTC(
    tomorrowCalendar.getUTCFullYear(),
    tomorrowCalendar.getUTCMonth() + 1,
    tomorrowCalendar.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone
  );

  return {
    startOfDay,
    endOfDay: new Date(startOfTomorrow.getTime() - 1),
  };
};

export const isPasswordValiable = (passWord) => {
  if (typeof passWord !== 'string' || passWord.length < 8) {
    return false;
  }
  return true;
}

const normalizeRequiredString = (value, fieldName) => {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} phải là chuỗi`);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} không được để trống`);
  }

  return normalizedValue;
};

const normalizeOptionalString = (value, fieldName) => {
  if (value === undefined) return '';

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} phải là chuỗi`);
  }

  return value.trim();
};

//partial = false → đây là dữ liệu đầy đủ để tạo thẻ
//partial = true  → đây chỉ là một phần dữ liệu cần cập nhật
export const normalizeCardContent = (
  data,
  { partial = false } = {},
) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Dữ liệu thẻ không hợp lệ');
  }

  const normalized = {};

  if (!partial || data.front !== undefined) {
    normalized.front = normalizeRequiredString(
      data.front,
      'Mặt trước',
    );
  }

  if (!partial || data.back !== undefined) {
    normalized.back = normalizeRequiredString(
      data.back,
      'Mặt sau',
    );
  }

  if (!partial || data.pronunciation !== undefined) {
    normalized.pronunciation = normalizeOptionalString(
      data.pronunciation,
      'Phiên âm',
    );
  }

  if (!partial || data.speechText !== undefined) {
    normalized.speechText = normalizeOptionalString(
      data.speechText,
      'Nội dung phát âm',
    );
  }

  if (!partial || data.examples !== undefined) {
    const examples = data.examples === undefined
      ? []
      : data.examples;

    if (!Array.isArray(examples)) {
      throw new Error('Danh sách ví dụ phải là một mảng');
    }

    normalized.examples = examples.map((example, index) => {
      if (
        !example ||
        typeof example !== 'object' ||
        Array.isArray(example)
      ) {
        throw new Error(`Ví dụ số ${index + 1} không hợp lệ`);
      }

      return {
        text: normalizeRequiredString(
          example.text,
          `Nội dung ví dụ số ${index + 1}`,
        ),
        translation: normalizeOptionalString(
          example.translation,
          `Bản dịch ví dụ số ${index + 1}`,
        ),
        ttsText: normalizeOptionalString(
          example.ttsText,
          `Nội dung TTS ví dụ số ${index + 1}`,
        ),
      };
    });
  }
  return normalized;
};


export const parseValidDate = (value, fieldName) => {
  if (!value) return null;

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${fieldName} không hợp lệ`);
  }

  return parsedDate;
};