/**
 * Analytics and Progress Statistics Calculator
 */

export function calculateCourseStats(course) {
  if (!course || !course.sections) {
    return {
      totalTopics: 0,
      completedTopics: 0,
      totalHours: 0,
      completedHours: 0,
      percentage: 0
    };
  }

  let totalTopics = 0;
  let completedTopics = 0;
  let totalHours = 0;
  let completedHours = 0;

  course.sections.forEach(sec => {
    sec.topics.forEach(top => {
      totalTopics++;
      totalHours += top.hours || 1;
      if (top.completed) {
        completedTopics++;
        completedHours += top.hours || 1;
      }
    });
  });

  const percentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return {
    totalTopics,
    completedTopics,
    totalHours,
    completedHours,
    percentage
  };
}

export function calculateOverallStats(courses) {
  let grandTotalTopics = 0;
  let grandCompletedTopics = 0;
  let grandTotalHours = 0;
  let grandCompletedHours = 0;

  courses.forEach(course => {
    const s = calculateCourseStats(course);
    grandTotalTopics += s.totalTopics;
    grandCompletedTopics += s.completedTopics;
    grandTotalHours += s.totalHours;
    grandCompletedHours += s.completedHours;
  });

  const overallPercentage = grandTotalTopics > 0 
    ? Math.round((grandCompletedTopics / grandTotalTopics) * 100) 
    : 0;

  return {
    totalCourses: courses.length,
    grandTotalTopics,
    grandCompletedTopics,
    grandTotalHours,
    grandCompletedHours,
    overallPercentage,
    streakDays: getActiveStreak()
  };
}

function getActiveStreak() {
  // Retrieve saved streak or default to active 3 day streak
  const savedStreak = localStorage.getItem('learning_streak_days');
  return savedStreak ? parseInt(savedStreak, 10) : 3;
}
