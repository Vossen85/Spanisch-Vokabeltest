ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.teacher_courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quarter_number smallint CHECK (quarter_number BETWEEN 1 AND 4);

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS student_user_id uuid REFERENCES public.course_students(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tests_course_quarter_idx
  ON public.tests(course_id, quarter_number);

CREATE INDEX IF NOT EXISTS submissions_student_user_submitted_idx
  ON public.submissions(student_user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS submissions_test_student_code_idx
  ON public.submissions(test_id, student_code);
