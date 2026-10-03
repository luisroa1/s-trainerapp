export function clearSuccessfulActivationFlow(currentUrl) {
  const completedUrl = new URL(currentUrl);
  const remainingParams = [...completedUrl.searchParams.entries()].filter(
    ([key, value]) => key !== 'flow' || value !== 'activate',
  );
  completedUrl.search = new URLSearchParams(remainingParams).toString();

  return `${completedUrl.pathname}${completedUrl.search}${completedUrl.hash}`;
}
