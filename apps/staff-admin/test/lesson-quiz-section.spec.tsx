import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import toast from 'react-hot-toast';
import { LessonQuizSection } from '../app/dashboard/courses/[id]/units/[unitId]/lessons/[lessonId]/LessonQuizSection';
import { fetchApi } from '../lib/api';

jest.mock('../lib/api', () => ({
  fetchApi: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const mockFetch = fetchApi as jest.Mock;

const EMPTY_STATE = {
  data: {
    lessonId: 'lesson-1',
    enabled: false,
    assessmentId: null,
    questions: [],
  },
};

const CONFIG_WITH_QUESTIONS = {
  data: {
    lessonId: 'lesson-1',
    enabled: true,
    assessmentId: 'assess-1',
    passingScore: 2,
    questions: [
      {
        questionId: 'q-1',
        titleAr: 'ما هي عاصمة مصر؟',
        options: [
          { id: 'a', text: 'القاهرة' },
          { id: 'b', text: 'الإسكندرية' },
        ],
        correctOptionId: 'a',
        points: 2,
      },
      {
        questionId: 'q-2',
        titleAr: 'كم عدد أيام الأسبوع؟',
        options: [
          { id: 'a', text: '6' },
          { id: 'b', text: '7' },
        ],
        correctOptionId: 'b',
        points: 1,
      },
    ],
  },
};

describe('LessonQuizSection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
  });

  it('shows the disabled state with no question configuration', async () => {
    mockFetch.mockResolvedValue(EMPTY_STATE);
    render(<LessonQuizSection lessonId="lesson-1" />);
    await waitFor(() => expect(screen.getByText('اختبار نهاية الدرس')).toBeInTheDocument());
    expect(screen.queryByText('درجة النجاح')).not.toBeInTheDocument();
    expect(screen.queryByText('لم تتم إضافة أسئلة بعد')).not.toBeInTheDocument();
  });

  it('shows the empty state and counter when enabled with no questions', async () => {
    mockFetch.mockResolvedValue({
      data: { lessonId: 'lesson-1', enabled: true, assessmentId: null, questions: [] },
    });
    render(<LessonQuizSection lessonId="lesson-1" />);
    await waitFor(() =>
      expect(screen.getByText('لم تتم إضافة أسئلة بعد')).toBeInTheDocument(),
    );
    expect(screen.getByText(/عدد الأسئلة:/)).toBeInTheDocument();
    expect(screen.getByText(/إجمالي الدرجات:/)).toBeInTheDocument();
  });

  it('adds a new question immediately when clicking إضافة سؤال', async () => {
    mockFetch.mockResolvedValue(EMPTY_STATE);
        render(<LessonQuizSection lessonId="lesson-1" />);
    await waitFor(() =>
      expect(screen.getByText('تفعيل الاختبار')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
    });
    await act(async () => {
      fireEvent.click(screen.getAllByText('إضافة سؤال')[0]);
    });
    expect(screen.getByText('السؤال 1')).toBeInTheDocument();
    expect(screen.getByText('نص السؤال')).toBeInTheDocument();
  });

  it('loads and renders persisted questions for this lesson', async () => {
    mockFetch.mockResolvedValue(CONFIG_WITH_QUESTIONS);
    render(<LessonQuizSection lessonId="lesson-1" />);
    await waitFor(() =>
      expect(screen.getByText('ما هي عاصمة مصر؟')).toBeInTheDocument(),
    );
    expect(screen.getByText('كم عدد أيام الأسبوع؟')).toBeInTheDocument();
    expect(screen.getByText('السؤال 1')).toBeInTheDocument();
    expect(screen.getByText('السؤال 2')).toBeInTheDocument();
    // total points = 2 + 1
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('blocks saving when passing score exceeds total points', async () => {
    mockFetch.mockResolvedValue({
      data: { lessonId: 'lesson-1', enabled: true, assessmentId: null, passingScore: 7, questions: [] },
    });
        render(<LessonQuizSection lessonId="lesson-1" />);
    await waitFor(() =>
      expect(screen.getByText('لم تتم إضافة أسئلة بعد')).toBeInTheDocument(),
    );
    // add one question worth 1 point, passing stays 7 -> invalid
    await act(async () => {
      fireEvent.click(screen.getByText('+ إضافة سؤال'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('حفظ اختبار نهاية الدرس'));
    });
    // passing score (7) exceeds total points (1): block save and surface error
    expect(screen.getByText(/أكبر من إجمالي الدرجات/)).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/lesson-quiz'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('persists enabled, passing score and questions via PUT with questionId preserved', async () => {
    mockFetch.mockResolvedValue(CONFIG_WITH_QUESTIONS);
        render(<LessonQuizSection lessonId="lesson-1" />);
    await waitFor(() =>
      expect(screen.getByText('ما هي عاصمة مصر؟')).toBeInTheDocument(),
    );
    await act(async () => {
      fireEvent.click(screen.getByText('حفظ اختبار نهاية الدرس'));
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/admin/v1/lessons/lesson-1/lesson-quiz',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"questionId":"q-1"'),
      }),
    );
  });
});
