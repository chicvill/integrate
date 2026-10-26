using UnityEngine;

namespace ModernClock
{
    [CreateAssetMenu(fileName = "ClockConfiguration", menuName = "Configuration/ClockConfiguration", order = 1)]
    public class ClockConfigurationSO : ScriptableObject
    {
        public TimeStartPoint StartPoint;
        public TimeFormat Format;

        [Header("Animation parameters: ")]
        [Range(0.01f, 1)]
        public float LerpTime;
        public AnimationCurve HighlightCurve;
    }

    public enum TimeFormat
    {
        Hours12 = 0,
        Hours24
    }

    public enum TimeStartPoint
    {
        LocalDevice = 0,
    }
}
