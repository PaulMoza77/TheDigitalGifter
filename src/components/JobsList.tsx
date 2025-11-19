import { memo, useMemo, useState } from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { useJobsQuery, useDeleteJobMutation } from "@/data";

export const JobsList = memo(function JobsList() {
  const { data: jobs = [] } = useJobsQuery();
  const deleteJob = useDeleteJobMutation();
  const [deletingJobs, setDeletingJobs] = useState<Set<string>>(new Set());

  const handleDelete = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this creation?")) {
      return;
    }

    setDeletingJobs((prev) => new Set(prev).add(jobId));
    try {
      await deleteJob.mutateAsync({ jobId: jobId as Id<"jobs"> });
      toast.success("Creation deleted successfully");
    } catch {
      toast.error("Failed to delete creation");
    } finally {
      setDeletingJobs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Download started!");
    } catch {
      toast.error("Failed to download image");
    }
  };

  const hasJobs = jobs.length > 0;

  // Group jobs by status (memoized for performance)
  const groupedJobs = useMemo(() => {
    return jobs.reduce<Record<string, Doc<"jobs">[]>>((acc, job) => {
      if (!acc[job.status]) acc[job.status] = [];
      acc[job.status].push(job);
      return acc;
    }, {});
  }, [jobs]);

  const statusOrder = ["processing", "queued", "done", "error"];
  const statusIcons = {
    queued: "⏳",
    processing: "🎨",
    done: "✅",
    error: "❌",
  };

  if (!hasJobs) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
        <div className="text-4xl mb-3">🎄</div>
        <p className="text-lg font-medium mb-2">No Christmas cards yet!</p>
        <p className="text-sm">
          Start by creating your first AI-generated Christmas card using our
          templates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statusOrder.map((status) => {
        const statusJobs = groupedJobs[status] || [];
        if (statusJobs.length === 0) return null;

        return (
          <div key={status}>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              {statusIcons[status as keyof typeof statusIcons]}
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="text-sm font-normal text-gray-500">
                ({statusJobs.length})
              </span>
            </h3>

            <div className="grid gap-4">
              {statusJobs.map((job: Doc<"jobs">) => (
                <div
                  key={job._id}
                  className="bg-white rounded-lg shadow-md p-4 border-l-4 border-l-red-500"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          {job.type === "video" ? "🎬 VIDEO" : "🎄 IMAGE"}
                        </span>
                        <StatusBadge status={job.status} />
                        {job.debited && (
                          <span className="text-xs text-gray-500">
                            💳 {job.debited} credits
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {job.prompt}
                      </p>
                      <div className="text-xs text-gray-400">
                        Created {new Date(job._creationTime).toLocaleString()}
                        {job.updatedAt && job.updatedAt !== job.createdAt && (
                          <span className="ml-2">
                            • Updated {new Date(job.updatedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        void handleDelete(job._id);
                      }}
                      disabled={deletingJobs.has(job._id)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1"
                      title="Delete creation"
                    >
                      {deletingJobs.has(job._id) ? "⏳" : "🗑️"}
                    </button>
                  </div>

                  {job.status === "done" && job.resultUrl && (
                    <div className="mt-3">
                      <div className="relative group">
                        {job.type === "video" ? (
                          <div className="w-full">
                            <video
                              src={job.resultUrl}
                              controls
                              className="w-full h-48 object-cover rounded-md border-2 border-red-200 bg-black"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() =>
                                  window.open(job.resultUrl, "_blank")
                                }
                                className="bg-white text-gray-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                              >
                                👁️ View
                              </button>
                              <button
                                onClick={() => {
                                  void handleDownload(
                                    job.resultUrl!,
                                    `video-${job._id}.mp4`
                                  );
                                }}
                                className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                              >
                                📥 Download
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <img
                              src={job.resultUrl}
                              alt="Generated Christmas card"
                              className="w-full h-48 object-cover rounded-md border-2 border-red-200"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-md flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                  onClick={() =>
                                    window.open(job.resultUrl, "_blank")
                                  }
                                  className="bg-white text-gray-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                                >
                                  👁️ View
                                </button>
                                <button
                                  onClick={() => {
                                    void handleDownload(
                                      job.resultUrl!,
                                      `christmas-card-${job._id}.jpg`
                                    );
                                  }}
                                  className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
                                >
                                  📥 Download
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {job.status === "processing" && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-700">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="text-sm font-medium">
                          Creating your Christmas magic...
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        This usually takes 30-60 seconds
                      </p>
                    </div>
                  )}

                  {job.status === "error" && job.errorMessage && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      <div className="font-medium mb-1">❌ Error occurred:</div>
                      <div>{job.errorMessage}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const colors = {
    queued: "bg-yellow-100 text-yellow-800 border-yellow-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    done: "bg-green-100 text-green-800 border-green-200",
    error: "bg-red-100 text-red-800 border-red-200",
  };

  const icons = {
    queued: "⏳",
    processing: "🎨",
    done: "✅",
    error: "❌",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${colors[status as keyof typeof colors]}`}
    >
      {icons[status as keyof typeof icons]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
});
