using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace ModernClock
{
    public class ClockController<T> where T : ClockView
    {
        private T _view;
        private ClockModel _model;

        private IEnumerator _timer;

        private List<TimeView> _allTimeViews = new List<TimeView>();

        private Dictionary<TimeViewType, int> _lastClockViewValue = new Dictionary<TimeViewType, int>();

        public void Mediate(T view, ClockModel model)
        {
            if (view == null)
            {
                return;
            }
            _view = view;

            if (model == null)
            {
                return;
            }
            _model = model;

            _lastClockViewValue = new Dictionary<TimeViewType, int>()
            {
                { TimeViewType.H1, -1},
                { TimeViewType.H2, -1},
                { TimeViewType.M1, -1},
                { TimeViewType.M2, -1},
                { TimeViewType.S1, -1},
                { TimeViewType.S2, -1},
            };
        }

        /// <summary>
        /// Start timer routine.
        /// </summary>
        public void Start()
        {
            if (_view == null || _model == null)
            {
                return;
            }

            if (_timer != null)
            {
                _view.StopCoroutine(_timer);
                _timer = null;
            }
            _timer = ClockTimer();
            _view.StartCoroutine(_timer);
        }

        public void Unmediate()
        {
            if (_timer != null)
            {
                _view.StopCoroutine(_timer);
                _timer = null;
            }
        }

        private IEnumerator ClockTimer()
        {
            while (true)
            {
                yield return new WaitForSeconds(1.0f);

                _model.Time = DateTime.Now;

                var hourFormat = _model.Format == TimeFormat.Hours24 ? _model.Time.Hour : _model.Time.Hour % 12;

                var h1 = hourFormat / 10;
                var h2 = hourFormat % 10;
                var m1 = _model.Time.Minute / 10;
                var m2 = _model.Time.Minute % 10;
                var s1 = _model.Time.Second / 10;
                var s2 = _model.Time.Second % 10;

                var h1Start = GetStartPosition(TimeViewType.H1);
                var h2Start = GetStartPosition(TimeViewType.H2);

                var m1Start = GetStartPosition(TimeViewType.M1);
                var m2Start = GetStartPosition(TimeViewType.M2);

                var s1Start = GetStartPosition(TimeViewType.S1);
                var s2Start = GetStartPosition(TimeViewType.S2);

                _model.Rects = new List<ClockRectData>()
                {
                    new ClockRectData()
                    {
                        StartPosition = h1Start,
                        EndPosition = GetEndPosition(TimeViewType.H1, h1Start, h1),
                        Type = TimeViewType.H1,
                        IsShouldChangePosition = _lastClockViewValue[TimeViewType.H1] != h1
                    },
                    new ClockRectData()
                    {
                        StartPosition = h2Start,
                        EndPosition = GetEndPosition(TimeViewType.H2, h2Start, h2),
                        Type = TimeViewType.H2,
                        IsShouldChangePosition = _lastClockViewValue[TimeViewType.H2] != h2
                    },
                    new ClockRectData()
                    {
                        StartPosition = m1Start,
                        EndPosition = GetEndPosition(TimeViewType.M1, m1Start, m1),
                        Type = TimeViewType.M1,
                        IsShouldChangePosition = _lastClockViewValue[TimeViewType.M1] != m1
                    },
                    new ClockRectData()
                    {
                        StartPosition = m2Start,
                        EndPosition = GetEndPosition(TimeViewType.M2, m2Start, m2),
                        Type = TimeViewType.M2,
                        IsShouldChangePosition = _lastClockViewValue[TimeViewType.M2] != m2
                    },
                    new ClockRectData()
                    {
                        StartPosition = s1Start,
                        EndPosition = GetEndPosition(TimeViewType.S1, s1Start, s1),
                        Type = TimeViewType.S1,
                        IsShouldChangePosition = _lastClockViewValue[TimeViewType.S1] != s1
                    },
                    new ClockRectData()
                    {
                        StartPosition = s2Start,
                        EndPosition = GetEndPosition(TimeViewType.S2, s2Start, s2),
                        Type = TimeViewType.S2,
                        IsShouldChangePosition = _lastClockViewValue[TimeViewType.S2] != s2
                    },
                };

                _lastClockViewValue = new Dictionary<TimeViewType, int>()
                {
                    { TimeViewType.H1, h1},
                    { TimeViewType.H2, h2},
                    { TimeViewType.M1, m1},
                    { TimeViewType.M2, m2},
                    { TimeViewType.S1, s1},
                    { TimeViewType.S2, s2},
                };
                _view.OnModelChange(_model);
            }
        }

        public void InitTimeViews(GameObject timeViewPrefab)
        {
            if (_view == null || _model == null)
            {
                return;
            }
            var timeViewValues = new List<TimeViewValueData>()
            {
                new TimeViewValueData(){Type = TimeViewType.H1, Rect = _view.SubContainers.First(x=>x.Type == TimeViewType.H1).ContainerRect, Value = _model.H1 },
                new TimeViewValueData(){Type = TimeViewType.H2, Rect = _view.SubContainers.First(x=>x.Type == TimeViewType.H2).ContainerRect, Value = _model.H2 },
                new TimeViewValueData(){Type = TimeViewType.M1, Rect = _view.SubContainers.First(x=>x.Type == TimeViewType.M1).ContainerRect, Value = _model.M1 },
                new TimeViewValueData(){Type = TimeViewType.M2, Rect = _view.SubContainers.First(x=>x.Type == TimeViewType.M2).ContainerRect, Value = _model.M2 },
                new TimeViewValueData(){Type = TimeViewType.S1, Rect = _view.SubContainers.First(x=>x.Type == TimeViewType.S1).ContainerRect, Value = _model.S1 },
                new TimeViewValueData(){Type = TimeViewType.S2, Rect = _view.SubContainers.First(x=>x.Type == TimeViewType.S2).ContainerRect, Value = _model.S2 },
            };

            for (int i = 0; i < timeViewValues.Count; i++)
            {
                var timeValueData = timeViewValues[i];
                InstantiateViews(timeViewPrefab, timeValueData);
            }
        }

        private void InstantiateViews(GameObject timeViewPrefab, TimeViewValueData data)
        {
            if (data == null || data.Value == 0 || timeViewPrefab == null)
            {
                return;
            }

            for (int i = 0; i < data.Value + 1; i++)
            {
                var timePrefab = UnityEngine.Object.Instantiate(timeViewPrefab, data.Rect);
                var timeView = timePrefab.GetComponent<TimeView>();
                if (timeView)
                {
                    timeView.SetView(new TimeModel() { Value = i, Type = data.Type });
                    _allTimeViews.Add(timeView);
                }
            }
        }

        public Vector2 GetStartPosition(TimeViewType type)
        {
            return _view.SubContainers.First(x => x.Type == type).ContainerRect.anchoredPosition;
        }

        public Vector2 GetEndPosition(TimeViewType type, Vector2 startPos, int value)
        {
            var endAchoredPos = _allTimeViews.First(x => x.GetViewType() == type && x.GetValue() == value).Rect.anchoredPosition;

            return new Vector3(startPos.x, Mathf.Abs(endAchoredPos.y));
        }
    }
}