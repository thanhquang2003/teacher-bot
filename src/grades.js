const GRADES = {
  '2': 'Lớp 2',
  '5': 'Lớp 5',
  '6': 'Lớp 6',
  '9': 'Lớp 9',
  '12': 'Lớp 12',
  'dai-hoc': 'Đại học',
};

const isGrade = (g) => Object.hasOwn(GRADES, g);

module.exports = { GRADES, isGrade };
