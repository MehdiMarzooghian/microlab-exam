(() => {
  const banks = [window.MICROLAB_QUESTIONS, window.MICROLAB_QUESTIONS_34, window.MICROLAB_QUESTIONS_56];
  const find = (id) => banks.flat().find((question) => question.id === id);
  const plan = [
    ['E-006','easy',1],['E-019','easy',1],
    ['M-017','medium',1],['M-018','medium',1],['M-016','medium',1],
    ['H-007','hard',1],['H-010','hard',1],['H-001','hard',1],

    ['E-013','easy',2],['E-021','easy',2],
    ['M-020','medium',2],['M-022','medium',2],['E-022','medium',2],
    ['H-017','hard',2],['H-018','hard',2],['H-022','hard',2],

    ['L34-E-008','easy',3],['L34-E-009','easy',3],['L34-E-017','easy',3],
    ['L34-M-004','medium',3],['L34-M-005','medium',3],
    ['L34-H-001','hard',3],['L34-H-006','hard',3],['L34-H-008','hard',3],

    ['L34-E-018','easy',4],['L34-E-019','easy',4],['L34-E-020','easy',4],
    ['L34-M-011','medium',4],['L34-M-017','medium',4],
    ['L34-H-011','hard',4],['L34-H-012','hard',4],['L34-H-020','hard',4],

    ['L56-E-001','easy',5],['L56-E-005','easy',5],['L56-E-014','easy',5],
    ['L56-M-002','medium',5],['L56-M-004','medium',5],['L56-M-010','medium',5],
    ['L56-H-001','hard',5],['L56-H-003','hard',5],

    ['L56-E-016','easy',6],['L56-E-017','easy',6],['L56-E-019','easy',6],
    ['L56-M-013','medium',6],['L56-M-015','medium',6],['L56-M-019','medium',6],
    ['L56-H-011','hard',6],['L56-H-020','hard',6]
  ];

  const counters = { easy:0, medium:0, hard:0 };
  window.MICROLAB_STUDY_GUIDE_QUESTIONS = plan.map(([id, level, module]) => {
    const original = find(id);
    if (!original) throw new Error(`Study Guide source question not found: ${id}`);
    counters[level] += 1;
    return {
      ...original,
      id:`SG-${level[0].toUpperCase()}-${String(counters[level]).padStart(3, '0')}`,
      level,
      module,
      source:`Study Guide · Lab Module ${String(module).padStart(2, '0')} objective`
    };
  });
})();
