using UnityEngine;
using UnityEngine.UI;

namespace ModernClock
{
    public class TimeView : MonoBehaviour
    {
        public RectTransform Rect;
        public Text TimeText;

        private TimeModel _model;

        public void SetView(TimeModel model)
        {
            if (model == null)
            {
                return;
            }
            _model = model;

            TimeText.text = model.Value.ToString();
        }

        public TimeViewType GetViewType()
        {
            return _model.Type;
        }

        public int GetValue()
        {
            return _model.Value;
        }
    }
}