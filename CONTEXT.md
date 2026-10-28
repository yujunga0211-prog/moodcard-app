# MoodCard

**User**가 오늘의 **Diary**를 쓰면, AI가 **Emotion Analysis**를 하고 가사 감정이 비슷한 **Song** 3곡을 추천해, 그 결과를 **Card**로 남기는 기분 일기장.

## Language

**User**:
구글 계정으로 로그인한 사람. 자기 Diary와 Card만 볼 수 있다. 첫 사용 때 "일기 내용은 감정 분석을 위해 AI 서비스로 전송됩니다"에 동의해야 Diary를 쓸 수 있다.
_Avoid_: 회원, 계정, Member

**Diary**:
한 User가 하루에 하나 쓰는 글. 같은 날 다시 쓰면 그날 Diary를 수정한다. 본문은 본인만 볼 수 있고 공유되지 않는다.
_Avoid_: 일지, Entry, Post

**Emotion**:
KOTE 감정 목록을 약 30개로 정리한 감정 하나(예: 불안, 후련함, 서운함). 정해진 목록 밖의 감정은 쓰지 않는다.
_Avoid_: 기분, Feeling, Mood(Mood Group과 헷갈림)

**Mood Group**:
비슷한 Emotion을 묶은 8개 묶음(예: 슬픔·그리움, 불안·걱정). 감정 캘린더의 색과 노래 목록의 균형을 맞추는 데 쓴다.
_Avoid_: 카테고리, 감정 색

**Emotion Analysis**:
LLM이 Diary 본문을 읽고 Emotion마다 0~1 점수를 매긴 결과. 화면에는 상위 3개 Emotion을 비율로 보여 준다(예: 불안 45% · 후련함 35% · 피곤함 20%). 점수 전체가 **Emotion Vector**가 된다.
_Avoid_: 감정 분류 결과, Sentiment

**Emotion Vector**:
Emotion 순서대로 점수를 늘어놓은 벡터. Diary와 Song 모두 같은 Emotion 목록, 같은 프롬프트로 만들어서 서로 비교할 수 있다.

**Song**:
추천 대상이 되는 노래 한 곡. 제목, 가수, 언어(한국 / 팝송), 가사의 Emotion Vector를 가진다. **가사 원문은 저장하지 않는다.** 미리 만든 목록 안의 곡만 추천한다.
_Avoid_: Track, 음원, 곡 데이터

**Recommendation**:
한 Diary에 대해 고른 Song 3곡과 곡마다의 추천 이유. 점수 공식(감정 유사도 − 최근 추천 반복 벌점)으로 고른다. User는 한국 노래 / 팝송 / 둘 다 중에서 범위를 고를 수 있다.
_Avoid_: 플레이리스트, 결과

**Card**:
한 Diary의 Emotion Analysis와 Recommendation을 담은 결과물. 공유 링크(`/card/{id}`)로 로그인 없이 볼 수 있지만, Diary 본문은 담지 않는다.
_Avoid_: 결과 페이지, Share
