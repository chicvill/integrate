using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace ModernClock
{
    public class ClockView : MonoBehaviour
    {
        public ClockModel _model;

        public List<ClockSubContainerView> SubContainers = new List<ClockSubContainerView>();

        private IEnumerator _animateRoutine;

        public void OnModelChange(ClockModel model)
        {
            if (model == null)
            {
                return;
            }

            _model = model;

            if (_animateRoutine != null)
            {
                StopCoroutine(_animateRoutine);
                _animateRoutine = null;
            }
            _animateRoutine = Animate();
            StartCoroutine(_animateRoutine);
        }

        /// <summary>
        /// Animation routine of changing time values.
        /// </summary>
        /// <returns></returns>
        private IEnumerator Animate()
        {
            float animationTime = _model.LerpTime;
            float currentTime = 0f;
            float interpolatedValue = 0f;
            while (currentTime <= animationTime)
            {
                currentTime += Time.deltaTime;
                interpolatedValue = currentTime / animationTime;

                for (int i = 0; i < SubContainers.Count; i++)
                {
                    var container = SubContainers[i];
                    var startRect = container.ContainerRect;
                    var rectData = _model.Rects.First(x => x.Type == container.Type);

                    bool isShouldChangePosition = rectData.IsShouldChangePosition;
                    if (isShouldChangePosition)
                    {
                        startRect.anchoredPosition = LerpToAanchoredPosition(rectData.StartPosition, rectData.EndPosition, interpolatedValue);

                        if (container.ContainerImage != null)
                        {
                            var highlightImageColor = container.ContainerImage.color;
                            highlightImageColor.a = _model.HighlightCurve.Evaluate(interpolatedValue);

                            container.ContainerImage.color = highlightImageColor;
                        }
                    }
                }

                yield return new WaitForEndOfFrame();
            }
        }

        /// <summary>
        /// Get lerp value between two points.
        /// </summary>
        private Vector2 LerpToAanchoredPosition(Vector2 startPos, Vector2 endPos, float normalized)
        {
            return Vector2.Lerp(startPos, endPos, normalized);
        }
    }
}