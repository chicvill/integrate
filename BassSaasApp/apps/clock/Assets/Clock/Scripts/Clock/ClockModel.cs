using System;
using System.Collections.Generic;
using UnityEngine;

namespace ModernClock
{
    public class ClockModel
    {
        public TimeStartPoint StartPoint;
        public TimeFormat Format;
        public DateTime Time;

        public int H1;
        public int H2;
        public int M1;
        public int M2;
        public int S1;
        public int S2;

        public float LerpTime;
        public AnimationCurve HighlightCurve;

        public List<ClockRectData> Rects;
    }

    public class ClockRectData
    {
        public TimeViewType Type;
        public Vector2 StartPosition;
        public Vector2 EndPosition;
        public bool IsShouldChangePosition;
    }
}
