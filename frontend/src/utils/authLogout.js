function runTasks(tasks, phase, reportError) {
  const errors = [];

  tasks.forEach((task) => {
    try {
      task();
    } catch (error) {
      errors.push(error);
      reportError(`Logout ${phase} failed:`, error);
    }
  });

  return errors;
}

export async function completeLogout({
  beforeTasks = [],
  signOut,
  cleanupTasks = [],
  reportError = console.error,
} = {}) {
  const beforeErrors = runTasks(beforeTasks, "preparation", reportError);
  let signOutError = null;

  try {
    if (signOut) {
      await signOut();
    }
  } catch (error) {
    signOutError = error;
    reportError("Supabase signOut failed:", error);
  } finally {
    const cleanupErrors = runTasks(cleanupTasks, "cleanup", reportError);
    return { beforeErrors, signOutError, cleanupErrors };
  }
}
