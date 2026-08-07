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