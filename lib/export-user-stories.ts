export async function exportUserStoriesToExcel(analysisId: string, title: string, accessToken: string) {
  try {
    // Fetch user stories for this analysis
    const response = await fetch("/api/get-user-stories", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user stories");
    }

    const { data: allStories } = await response.json();

    // Filter stories for this analysis
    const stories = allStories.filter((s: any) => s.analysis_id === analysisId);

    if (stories.length === 0) {
      alert("No user stories found for this analysis");
      return;
    }

    // Create CSV content
    let csvContent = "Story ID,Priority,Title,Description,Story Points,Estimated Days,Acceptance Criteria\n";

    stories.forEach((saved: any) => {
      saved.stories.forEach((story: any, index: number) => {
        const criteria = story.acceptanceCriteria?.join("; ") || "";
        const row = [
          story.id,
          story.priority,
          `"${story.title.replace(/"/g, '""')}"`,
          `"${story.description.replace(/"/g, '""')}"`,
          story.storyPoints,
          story.estimatedDays,
          `"${criteria.replace(/"/g, '""')}"`,
        ].join(",");
        csvContent += row + "\n";
      });
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `${title}-user-stories-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Export error:", error);
    alert("Failed to export user stories: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}
