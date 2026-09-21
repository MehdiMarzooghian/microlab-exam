(() => {
  const detectModule = (question) => {
    if (question.module) return Number(question.module);
    const match = String(question.source || '').match(/(?:Module|LM)\s*0?([1-6])/i);
    return match ? Number(match[1]) : null;
  };
  const prepareQuestions = (questions) => {
    const answerPositions = {};
    const levelOffsets = { easy:0, medium:1, hard:2 };
    return questions.map((question) => {
      const prepared = { ...question, module:detectModule(question) };
      if (question.type !== 'mcq' || !Array.isArray(question.options)) return prepared;
      const group = question.level || 'all';
      const position = ((answerPositions[group] || 0) + (levelOffsets[group] || 0)) % question.options.length;
      answerPositions[group] = (answerPositions[group] || 0) + 1;
      const distractors = question.options.filter(option => option !== question.answer);
      const options = [...distractors];
      options.splice(position, 0, question.answer);
      return { ...prepared, options };
    });
  };

  const lessons12 = prepareQuestions(window.MICROLAB_QUESTIONS);
  const lessons34 = prepareQuestions(window.MICROLAB_QUESTIONS_34);
  const lessons56 = prepareQuestions(window.MICROLAB_QUESTIONS_56);
  const studyGuide = prepareQuestions(window.MICROLAB_STUDY_GUIDE_QUESTIONS);
  const allCourseQuestions = [...lessons12, ...lessons34, ...lessons56];

  const finalQuestions = [];
  for (const level of ['easy', 'medium', 'hard']) {
    for (let module = 1; module <= 6; module += 1) {
      const selected = allCourseQuestions.filter((question) => question.level === level && question.module === module).slice(0, 3);
      selected.forEach((question, index) => finalQuestions.push({
        ...question,
        id:`FINAL-${level[0].toUpperCase()}-M${module}-${index + 1}`,
        source:`Final Exam · Module ${String(module).padStart(2, '0')} · ${question.source}`
      }));
    }
  }
  const balancedFinalQuestions = prepareQuestions(finalQuestions);

  window.MICROLAB_BANKS = {
    lessons12: {
      id:'lessons12', title:'Lessons 01 & 02', shortTitle:'Lessons 01–02', code:'01–02', accent:'teal',
      description:'Safety, scientific method, microbial ubiquity, colony morphology, and hand hygiene.',
      questions:lessons12, sourceCount:4,
      coverage:[
        ['Module 01 PowerPoint','10 of 10 slides reviewed','Safety, notebook, scientific method, ubiquity'],
        ['Module 02 PDF','5 of 5 pages reviewed','Experiments 2.1–2.4 and figures'],
        ['Copied course Note','726 cleaned lines reviewed','Dates and sender IDs excluded'],
        ['Colony morphology image','All labels reviewed','Shape, margin, elevation, and properties']
      ]
    },
    lessons34: {
      id:'lessons34', title:'Lessons 03 & 04', shortTitle:'Lessons 03–04', code:'03–04', accent:'blue',
      description:'Microscopy, cell morphology, aseptic transfer, culture media, and pure-culture isolation.',
      questions:lessons34, sourceCount:5,
      coverage:[
        ['LM03 Microscopy and Cells PDF','5 of 5 pages reviewed','Experiments 3.1–3.3 and review questions'],
        ['LM04 Aseptic Technique PDF','6 of 6 pages reviewed','Experiments 4.1–4.4 and review questions'],
        ['Copied Lessons 03–04 Note','735 cleaned lines reviewed','Chat dates and sender IDs excluded'],
        ['Microscopy comparison image','All labels reviewed','Brightfield, phase, fluorescence, SEM, and TEM'],
        ['Compound microscope image','All labels reviewed','Parts, optics, illumination, and focusing controls']
      ]
    },
    lessons56: {
      id:'lessons56', title:'Lessons 05 & 06', shortTitle:'Lessons 05–06', code:'05–06', accent:'orange',
      description:'Smear preparation, staining, specialized bacterial structures, flagella, and motility.',
      questions:lessons56, sourceCount:7,
      coverage:[
        ['LM05 Staining PDF','4 of 4 pages reviewed','Experiments 5.1–5.4 and Gram-stain errors'],
        ['LM06 Specialized Structures PDF','6 of 6 pages reviewed','Experiments 6.1–6.6 and review questions'],
        ['Copied Lessons 05–06 Note','609 cleaned lines reviewed','Chat dates and sender IDs excluded'],
        ['Instructor Exam Review deck','43 of 43 slides reviewed','Microscopy, culturing, stains, structures, and images'],
        ['Three supplied reference images','All labels reviewed','Gram, endospore, and acid-fast interpretation']
      ]
    },
    studyGuide: {
      id:'studyGuide', title:'Study Guide Exam', shortTitle:'Study Guide', code:'GUIDE', accent:'purple',
      description:'A focused exam limited to the teacher-provided Lab Exam 1 Study Guide objectives.',
      questions:studyGuide, sourceCount:1,
      coverage:[
        ['Study Guide Lab Exam 1','3 of 3 pages and all 6 module sections reviewed','Every question maps to a listed Study Guide objective']
      ]
    },
    finalExam: {
      id:'finalExam', title:'Final Exam', shortTitle:'Final Exam', code:'01–06', accent:'navy',
      description:'A balanced cumulative exam combining all six laboratory modules.',
      questions:balancedFinalQuestions, sourceCount:16,
      coverage:[
        ['Modules 01–06 course bank','Three questions per module at every difficulty','Balanced cumulative sampling across all six modules'],
        ['Course PDFs, slides, notes, and figures','All reviewed source sets included','Safety through specialized structures and motility']
      ]
    }
  };
})();
