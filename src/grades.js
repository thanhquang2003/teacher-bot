const GRADES = {
  '2': 'Lớp 2',
  '5': 'Lớp 5',
  '6': 'Lớp 6',
  '9': 'Lớp 9',
  '12': 'Lớp 12',
  'dai-hoc': 'Đại học',
};

// Phụ huynh chỉ chọn được lớp của con ở hai cấp này.
const PARENT_GRADES = ['2', '5'];
const isParentGrade = (g) => PARENT_GRADES.includes(g);

const isGrade = (g) => Object.hasOwn(GRADES, g);

module.exports = { GRADES, PARENT_GRADES, isGrade, isParentGrade };
