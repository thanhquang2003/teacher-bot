const GRADES = {
  '5': 'Lớp 5',
  '6': 'Lớp 6',
  '9': 'Lớp 9',
  'dai-hoc': 'Đại học',
};

const isGrade = (g) => Object.hasOwn(GRADES, g);

module.exports = { GRADES, isGrade };
