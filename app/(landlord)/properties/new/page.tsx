import { BackButton } from "@/components/layout/BackButton";
import { NewPropertyForm } from "@/components/properties/NewPropertyForm";

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-md">
      <BackButton />
      <h1 className="text-2xl font-medium">Add a property</h1>
      <NewPropertyForm />
    </div>
  );
}
