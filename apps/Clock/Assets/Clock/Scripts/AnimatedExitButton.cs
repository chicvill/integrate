using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class ExitButton : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
{
    [Header("Button Colors")]
    public Color normalColor = new Color(0.1f, 0.8f, 0.1f, 1f);   // 평상시: 초록색
    public Color hoverColor = new Color(0.5f, 1f, 0.5f, 1f);     // 마우스오버 시: 밝은 연두색

    private Image buttonImage;

    void Start()
    {
        buttonImage = GetComponent<Image>();
        if (buttonImage != null)
            buttonImage.color = normalColor;
    }

    // 🖱️ 마우스가 버튼 위에 올라왔을 때
    public void OnPointerEnter(PointerEventData eventData)
    {
        if (buttonImage != null)
            buttonImage.color = hoverColor;
    }

    // 🖱️ 마우스가 버튼 밖으로 나갔을 때
    public void OnPointerExit(PointerEventData eventData)
    {
        if (buttonImage != null)
            buttonImage.color = normalColor;
    }

    // 🖱️ 버튼 클릭 시 프로그램 종료
    public void QuitProgram()
    {
#if UNITY_EDITOR
        UnityEditor.EditorApplication.isPlaying = false;
#else
        Application.Quit();
#endif
    }
}
