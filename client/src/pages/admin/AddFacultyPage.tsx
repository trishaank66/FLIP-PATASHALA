import { useAuth } from '@/hooks/use-auth';
import { ManualAddFaculty } from '@/components/ManualAddFaculty';

export default function AddFacultyPage() {
  const { user } = useAuth();

  return (
    <div className="container py-8">
      <div className="mb-8">
        <ManualAddFaculty />
      </div>
    </div>
  );
}