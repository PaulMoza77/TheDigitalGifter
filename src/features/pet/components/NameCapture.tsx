import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSecretLivesCta, validatePetName } from "../croGuards";
import { FieldError, petFieldClass } from "./FieldError";

export function NameCapture({
  value,
  autoFocus = true,
  onNameChange,
  onValidSubmit,
}: {
  value: string;
  autoFocus?: boolean;
  onNameChange: (name: string) => void;
  onValidSubmit: (name: string) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | undefined>();
  const cta = useMemo(() => createSecretLivesCta(value), [value]);

  return (
    <form
      className="mt-6 max-w-md space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const result = validatePetName(value);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setError(undefined);
        onValidSubmit(result.name);
      }}
      noValidate
    >
      <Label htmlFor={inputId} className="text-sm font-medium text-[#f6efe4]">
        Enter your pet’s name
      </Label>
      <Input
        id={inputId}
        name="petName"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={40}
        placeholder="Charlie"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`mt-2 ${petFieldClass(Boolean(error))}`}
        onChange={(event) => {
          onNameChange(event.target.value);
          setError(undefined);
        }}
      />
      <FieldError id={errorId} message={error} />
      <Button
        type="submit"
        className="h-12 min-h-[44px] w-full rounded-full bg-[#d4a84b] px-7 text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63] sm:w-auto"
      >
        {cta}
      </Button>
      <p className="text-sm text-[#f6efe4]/55">Takes less than 60 seconds · No charge yet</p>
    </form>
  );
}
