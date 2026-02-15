import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type UploadArgs = {
  file: File;
  path?: string; // optional custom path
};

export function useGenerateUploadUrlMutation() {
  return useMutation<string, Error, UploadArgs>({
    mutationKey: ["storage", "upload"],
    mutationFn: async ({ file, path }) => {
      const filePath =
        path ?? `uploads/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

      const { error } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, {
          upsert: false,
        });

      if (error) throw error;

      // Return public URL
      const { data } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      return data.publicUrl;
    },
  });
}