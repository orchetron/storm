export interface UseStderrResult {
  stderr: NodeJS.WriteStream;
  write: (data: string) => void;
}

export function useStderr(): UseStderrResult {
  return {
    stderr: process.stderr,
    write: (data: string) => {
      try {
        process.stderr.write(data);
      } catch {
        // stderr may be closed
      }
    },
  };
}
