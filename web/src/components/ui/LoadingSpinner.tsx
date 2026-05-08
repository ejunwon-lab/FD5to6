export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="w-8 h-8 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
      {message && <p className="text-sm text-gray-400">{message}</p>}
    </div>
  )
}
