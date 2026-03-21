import Skeleton from "@/components/ui/Skeleton";

export default function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-bg-secondary p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton variant="text" width="120px" />
        <div className="flex items-center gap-6">
          <Skeleton variant="circular" width="128px" height="128px" />
          <div className="space-y-3 flex-1">
            <Skeleton variant="text" width="300px" height="40px" />
            <Skeleton variant="text" width="200px" />
          </div>
        </div>
        <Skeleton variant="rectangular" height="40px" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton
              key={`skel-${
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                i
              }`}
              variant="rectangular"
              height="100px"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
